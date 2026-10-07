import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { ProductStatus } from '../catalog/catalog.enums';
import { Product } from '../catalog/entities/product.entity';
import { CartItem } from './entities/cart-item.entity';
import { Cart } from './entities/cart.entity';

export const CART_MAX_QTY = 20;

export type CartViewItem = {
  productId: string;
  slug: string;
  quantity: number;
};

@Injectable()
export class CartsService {
  constructor(
    @InjectRepository(Cart)
    private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly items: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  async getCart(owner: {
    userId?: string | null;
    guestKey?: string | null;
  }): Promise<{ items: CartViewItem[] }> {
    const cart = await this.findCart(owner);
    if (!cart) {
      return { items: [] };
    }
    return { items: this.toView(cart) };
  }

  async upsertItem(
    owner: { userId?: string | null; guestKey?: string | null },
    productId: string,
    quantity: number,
  ): Promise<{ items: CartViewItem[] }> {
    this.assertOwner(owner);
    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      quantity > CART_MAX_QTY
    ) {
      throw new BadRequestException(
        `quantity must be an integer from 0 to ${CART_MAX_QTY}.`,
      );
    }

    return this.carts.manager.transaction(async (manager) => {
      const cart = await this.getOrCreateCart(manager, owner);
      if (quantity === 0) {
        await manager.delete(CartItem, {
          cartId: cart.id,
          productId,
        });
      } else {
        const product = await manager.findOne(Product, {
          where: { id: productId },
        });
        if (!product || product.status !== ProductStatus.ACTIVE) {
          throw new BadRequestException('Product is not available.');
        }
        let item = await manager.findOne(CartItem, {
          where: { cartId: cart.id, productId },
        });
        if (!item) {
          item = manager.create(CartItem, {
            cartId: cart.id,
            productId,
            quantity,
          });
        } else {
          item.quantity = quantity;
        }
        await manager.save(item);
      }
      cart.updatedAt = new Date();
      await manager.save(cart);
      const loaded = await this.loadCart(manager, cart.id);
      return { items: this.toView(loaded) };
    });
  }

  async clear(owner: {
    userId?: string | null;
    guestKey?: string | null;
  }): Promise<{ items: CartViewItem[] }> {
    this.assertOwner(owner);
    const cart = await this.findCart(owner);
    if (!cart) {
      return { items: [] };
    }
    await this.items.delete({ cartId: cart.id });
    cart.updatedAt = new Date();
    await this.carts.save(cart);
    return { items: [] };
  }

  /**
   * Merge guest cart into the authenticated user cart, then delete the guest cart.
   * Quantities are summed and clamped to CART_MAX_QTY.
   */
  async mergeGuestIntoUser(
    userId: string,
    guestKey: string,
  ): Promise<{ items: CartViewItem[] }> {
    if (!guestKey?.trim()) {
      throw new BadRequestException('guestKey is required.');
    }

    return this.carts.manager.transaction(async (manager) => {
      const guest = await manager.findOne(Cart, {
        where: { guestKey: guestKey.trim() },
        lock: { mode: 'pessimistic_write' },
      });
      const userCart = await this.getOrCreateCart(manager, { userId });

      if (guest) {
        const guestItems = await manager.find(CartItem, {
          where: { cartId: guest.id },
          relations: { product: true },
        });
        for (const guestItem of guestItems) {
          if (
            !guestItem.product ||
            guestItem.product.status !== ProductStatus.ACTIVE
          ) {
            continue;
          }
          let item = await manager.findOne(CartItem, {
            where: {
              cartId: userCart.id,
              productId: guestItem.productId,
            },
            lock: { mode: 'pessimistic_write' },
          });
          const nextQty = Math.min(
            CART_MAX_QTY,
            (item?.quantity ?? 0) + guestItem.quantity,
          );
          if (!item) {
            item = manager.create(CartItem, {
              cartId: userCart.id,
              productId: guestItem.productId,
              quantity: nextQty,
            });
          } else {
            item.quantity = nextQty;
          }
          await manager.save(item);
        }
        await manager.delete(Cart, { id: guest.id });
      }

      userCart.updatedAt = new Date();
      await manager.save(userCart);
      const loaded = await this.loadCart(manager, userCart.id);
      return { items: this.toView(loaded) };
    });
  }

  private assertOwner(owner: {
    userId?: string | null;
    guestKey?: string | null;
  }) {
    if (owner.userId) {
      return;
    }
    if (owner.guestKey?.trim()) {
      return;
    }
    throw new UnauthorizedException(
      'Authentication or guest cart key required.',
    );
  }

  private async findCart(owner: {
    userId?: string | null;
    guestKey?: string | null;
  }): Promise<Cart | null> {
    if (owner.userId) {
      return this.carts.findOne({
        where: { userId: owner.userId },
        relations: { items: { product: true } },
      });
    }
    if (owner.guestKey?.trim()) {
      return this.carts.findOne({
        where: { guestKey: owner.guestKey.trim() },
        relations: { items: { product: true } },
      });
    }
    return null;
  }

  private async getOrCreateCart(
    manager: EntityManager,
    owner: { userId?: string | null; guestKey?: string | null },
  ): Promise<Cart> {
    if (owner.userId) {
      let cart = await manager.findOne(Cart, {
        where: { userId: owner.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cart) {
        cart = await manager.save(
          manager.create(Cart, {
            userId: owner.userId,
            guestKey: null,
          }),
        );
      }
      return cart;
    }
    const guestKey = owner.guestKey?.trim();
    if (!guestKey) {
      throw new UnauthorizedException(
        'Authentication or guest cart key required.',
      );
    }
    let cart = await manager.findOne(Cart, {
      where: { guestKey },
      lock: { mode: 'pessimistic_write' },
    });
    if (!cart) {
      cart = await manager.save(
        manager.create(Cart, {
          userId: null,
          guestKey,
        }),
      );
    }
    return cart;
  }

  private async loadCart(
    manager: EntityManager,
    cartId: string,
  ): Promise<Cart> {
    const cart = await manager.findOne(Cart, {
      where: { id: cartId },
      relations: { items: { product: true } },
    });
    if (!cart) {
      throw new BadRequestException('Cart could not be loaded.');
    }
    return cart;
  }

  private toView(cart: Cart): CartViewItem[] {
    return (cart.items ?? [])
      .filter(
        (item) => item.product && item.product.status === ProductStatus.ACTIVE,
      )
      .map((item) => ({
        productId: item.productId,
        slug: item.product.slug,
        quantity: item.quantity,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }
}
