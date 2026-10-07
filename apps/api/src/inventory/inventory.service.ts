import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Product } from '../catalog/entities/product.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { InventoryStock } from './entities/inventory-stock.entity';
import { Warehouse } from './entities/warehouse.entity';
import { InventoryMovementType } from './inventory.enums';

export const DEFAULT_WAREHOUSE_CODE = 'main';
export const DEFAULT_SEED_ON_HAND = 100;

/**
 * Storefront / checkout: products with available stock below this count
 * are treated as out of stock (sellable quantity reported as 0).
 * Admin inventory still shows true on-hand and reserved figures.
 */
export const MIN_STOREFRONT_AVAILABLE = 10;

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(Warehouse)
    private readonly warehouses: Repository<Warehouse>,
    @InjectRepository(InventoryStock)
    private readonly stock: Repository<InventoryStock>,
    @InjectRepository(InventoryMovement)
    private readonly movements: Repository<InventoryMovement>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  availableOf(row: InventoryStock): number {
    return Math.max(0, row.quantityOnHand - row.quantityReserved);
  }

  /**
   * Quantity customers may buy on the storefront.
   * Below MIN_STOREFRONT_AVAILABLE → 0 (shown as out of stock).
   */
  storefrontAvailable(rawAvailable: number): number {
    if (rawAvailable < MIN_STOREFRONT_AVAILABLE) {
      return 0;
    }
    return rawAvailable;
  }

  async getAvailableQuantities(
    productIds: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (productIds.length === 0) {
      return map;
    }
    const warehouse = await this.getDefaultWarehouse();
    const rows = await this.stock.find({
      where: {
        warehouseId: warehouse.id,
        productId: In(productIds),
      },
    });
    for (const id of productIds) {
      map.set(id, 0);
    }
    for (const row of rows) {
      map.set(row.productId, this.availableOf(row));
    }
    return map;
  }

  /** Public catalog quantities after applying the storefront minimum. */
  async getStorefrontAvailableQuantities(
    productIds: string[],
  ): Promise<Map<string, number>> {
    const raw = await this.getAvailableQuantities(productIds);
    const map = new Map<string, number>();
    for (const [id, qty] of raw) {
      map.set(id, this.storefrontAvailable(qty));
    }
    return map;
  }

  async getDefaultWarehouse(manager?: EntityManager): Promise<Warehouse> {
    const repo = manager ? manager.getRepository(Warehouse) : this.warehouses;
    const warehouse = await repo.findOne({
      where: { isDefault: true, isActive: true },
    });
    if (!warehouse) {
      throw new NotFoundException('Default warehouse is not configured.');
    }
    return warehouse;
  }

  async listStockForAdmin() {
    const warehouse = await this.getDefaultWarehouse();
    const products = await this.products.find({
      order: { name: 'ASC' },
    });
    const rows = await this.stock.find({
      where: { warehouseId: warehouse.id },
    });
    const byProduct = new Map(rows.map((row) => [row.productId, row]));
    return products.map((product) => {
      const row = byProduct.get(product.id);
      const quantityOnHand = row?.quantityOnHand ?? 0;
      const quantityReserved = row?.quantityReserved ?? 0;
      return {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        warehouseId: warehouse.id,
        warehouseCode: warehouse.code,
        quantityOnHand,
        quantityReserved,
        available: Math.max(0, quantityOnHand - quantityReserved),
        updatedAt: (row?.updatedAt ?? product.updatedAt).toISOString(),
      };
    });
  }

  async listRecentMovements(limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    const rows = await this.movements.find({
      relations: { product: true, warehouse: true },
      order: { createdAt: 'DESC' },
      take,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      productId: row.productId,
      productName: row.product?.name ?? null,
      warehouseCode: row.warehouse?.code ?? null,
      quantityDelta: row.quantityDelta,
      quantityAfter: row.quantityAfter,
      referenceType: row.referenceType,
      referenceId: row.referenceId,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async setQuantityOnHand(input: {
    productId: string;
    quantityOnHand: number;
    note?: string;
  }) {
    if (!Number.isInteger(input.quantityOnHand) || input.quantityOnHand < 0) {
      throw new BadRequestException(
        'quantityOnHand must be a non-negative integer.',
      );
    }
    const product = await this.products.findOne({
      where: { id: input.productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    const warehouse = await this.getDefaultWarehouse();

    return this.stock.manager.transaction(async (manager) => {
      let row = await manager.findOne(InventoryStock, {
        where: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        row = manager.create(InventoryStock, {
          warehouseId: warehouse.id,
          productId: product.id,
          quantityOnHand: 0,
          quantityReserved: 0,
        });
      }
      const before = row.quantityOnHand;
      const delta = input.quantityOnHand - before;
      row.quantityOnHand = input.quantityOnHand;
      await manager.save(row);
      await manager.save(
        manager.create(InventoryMovement, {
          warehouseId: warehouse.id,
          productId: product.id,
          type: InventoryMovementType.ADJUSTMENT,
          quantityDelta: delta,
          quantityAfter: row.quantityOnHand,
          referenceType: 'admin_adjustment',
          referenceId: null,
          note:
            input.note?.trim() ||
            `Set on-hand from ${before} to ${input.quantityOnHand}`,
        }),
      );
      return {
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        warehouseId: warehouse.id,
        warehouseCode: warehouse.code,
        quantityOnHand: row.quantityOnHand,
        quantityReserved: row.quantityReserved,
        available: this.availableOf(row),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  private orderLines(
    lines: Array<{ productId: string; quantity: number; productName: string }>,
  ) {
    return lines.filter((line) => Boolean(line.productId) && line.quantity > 0);
  }

  private async hasOrderSaleMovement(
    manager: EntityManager,
    orderId: string,
  ): Promise<boolean> {
    const sale = await manager.findOne(InventoryMovement, {
      where: {
        type: InventoryMovementType.SALE,
        referenceType: 'order',
        referenceId: orderId,
      },
    });
    return Boolean(sale);
  }

  /**
   * Place order: hold available units (↑ reserved). On-hand unchanged.
   * Idempotent when a reservation movement already exists for the order.
   */
  async reserveForOrder(
    manager: EntityManager,
    lines: Array<{ productId: string; quantity: number; productName: string }>,
    orderId: string,
  ): Promise<void> {
    const already = await manager.findOne(InventoryMovement, {
      where: {
        type: InventoryMovementType.RESERVATION,
        referenceType: 'order',
        referenceId: orderId,
      },
    });
    if (already) {
      return;
    }

    const warehouse = await this.getDefaultWarehouse(manager);
    for (const line of this.orderLines(lines)) {
      const row = await manager.findOne(InventoryStock, {
        where: {
          warehouseId: warehouse.id,
          productId: line.productId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      const available = row ? this.availableOf(row) : 0;
      const sellable = this.storefrontAvailable(available);
      if (!row || sellable < line.quantity) {
        throw new BadRequestException(
          sellable === 0
            ? `${line.productName} is out of stock.`
            : `Insufficient stock for ${line.productName}. Available: ${sellable}.`,
        );
      }
      row.quantityReserved += line.quantity;
      await manager.save(row);
      await manager.save(
        manager.create(InventoryMovement, {
          warehouseId: warehouse.id,
          productId: line.productId,
          type: InventoryMovementType.RESERVATION,
          quantityDelta: line.quantity,
          quantityAfter: row.quantityOnHand,
          referenceType: 'order',
          referenceId: orderId,
          note: `Reserved ${line.quantity} (reserved now ${row.quantityReserved})`,
        }),
      );
    }
  }

  /**
   * Confirm/ship: convert reservation into a sale (↓ reserved, ↓ on-hand).
   * Idempotent when a sale movement already exists for the order.
   * Legacy orders that already sold at place are no-ops.
   */
  async consumeReservedForSale(
    manager: EntityManager,
    lines: Array<{ productId: string; quantity: number; productName: string }>,
    orderId: string,
  ): Promise<void> {
    if (await this.hasOrderSaleMovement(manager, orderId)) {
      return;
    }

    const warehouse = await this.getDefaultWarehouse(manager);
    for (const line of this.orderLines(lines)) {
      const row = await manager.findOne(InventoryStock, {
        where: {
          warehouseId: warehouse.id,
          productId: line.productId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        throw new BadRequestException(
          `Insufficient stock for ${line.productName}. Available: 0.`,
        );
      }
      if (row.quantityReserved < line.quantity) {
        throw new BadRequestException(
          `Missing reservation for ${line.productName}. Reserved: ${row.quantityReserved}.`,
        );
      }
      if (row.quantityOnHand < line.quantity) {
        throw new BadRequestException(
          `Insufficient on-hand for ${line.productName}. On hand: ${row.quantityOnHand}.`,
        );
      }
      row.quantityReserved -= line.quantity;
      row.quantityOnHand -= line.quantity;
      await manager.save(row);
      await manager.save(
        manager.create(InventoryMovement, {
          warehouseId: warehouse.id,
          productId: line.productId,
          type: InventoryMovementType.SALE,
          quantityDelta: -line.quantity,
          quantityAfter: row.quantityOnHand,
          referenceType: 'order',
          referenceId: orderId,
          note: `Consumed reservation (reserved now ${row.quantityReserved})`,
        }),
      );
    }
  }

  /**
   * Cancel while still reserved (no sale yet): ↓ reserved only.
   * Idempotent when release already recorded, or when a sale exists (use restore instead).
   */
  async releaseReservation(
    manager: EntityManager,
    lines: Array<{ productId: string; quantity: number; productName: string }>,
    orderId: string,
  ): Promise<void> {
    const alreadyReleased = await manager.findOne(InventoryMovement, {
      where: {
        type: InventoryMovementType.RELEASE,
        referenceType: 'order',
        referenceId: orderId,
      },
    });
    if (alreadyReleased) {
      return;
    }
    if (await this.hasOrderSaleMovement(manager, orderId)) {
      return;
    }

    const warehouse = await this.getDefaultWarehouse(manager);
    for (const line of this.orderLines(lines)) {
      const row = await manager.findOne(InventoryStock, {
        where: {
          warehouseId: warehouse.id,
          productId: line.productId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        continue;
      }
      const releaseQty = Math.min(line.quantity, row.quantityReserved);
      if (releaseQty < 1) {
        continue;
      }
      row.quantityReserved -= releaseQty;
      await manager.save(row);
      await manager.save(
        manager.create(InventoryMovement, {
          warehouseId: warehouse.id,
          productId: line.productId,
          type: InventoryMovementType.RELEASE,
          quantityDelta: -releaseQty,
          quantityAfter: row.quantityOnHand,
          referenceType: 'order',
          referenceId: orderId,
          note: `Released reservation (${line.productName}); reserved now ${row.quantityReserved}`,
        }),
      );
    }
  }

  /**
   * Cancel: if stock was already sold for this order, restore on-hand;
   * otherwise release the reservation. Covers new reserve-on-place and
   * legacy consume-on-place orders.
   */
  async releaseOrRestoreOnCancel(
    manager: EntityManager,
    lines: Array<{ productId: string; quantity: number; productName: string }>,
    orderId: string,
  ): Promise<void> {
    if (await this.hasOrderSaleMovement(manager, orderId)) {
      await this.restoreForCancel(manager, lines, orderId);
      return;
    }
    await this.releaseReservation(manager, lines, orderId);
  }

  /**
   * Restore on-hand after cancel when a sale was already recorded.
   * Idempotent when a prior order_cancel movement exists for the order.
   */
  async restoreForCancel(
    manager: EntityManager,
    lines: Array<{ productId: string; quantity: number; productName: string }>,
    orderId: string,
  ): Promise<void> {
    const already = await manager.findOne(InventoryMovement, {
      where: {
        referenceType: 'order_cancel',
        referenceId: orderId,
      },
    });
    if (already) {
      return;
    }

    const warehouse = await this.getDefaultWarehouse(manager);
    for (const line of this.orderLines(lines)) {
      let row = await manager.findOne(InventoryStock, {
        where: {
          warehouseId: warehouse.id,
          productId: line.productId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        row = manager.create(InventoryStock, {
          warehouseId: warehouse.id,
          productId: line.productId,
          quantityOnHand: 0,
          quantityReserved: 0,
        });
      }
      row.quantityOnHand += line.quantity;
      await manager.save(row);
      await manager.save(
        manager.create(InventoryMovement, {
          warehouseId: warehouse.id,
          productId: line.productId,
          type: InventoryMovementType.RECEIPT,
          quantityDelta: line.quantity,
          quantityAfter: row.quantityOnHand,
          referenceType: 'order_cancel',
          referenceId: orderId,
          note: `Restored after cancel (${line.productName})`,
        }),
      );
    }
  }

  /**
   * Restock on-hand after return inspect (within caller transaction).
   * Idempotent when a return_restock movement already exists for the return.
   */
  async restockForReturn(
    manager: EntityManager,
    lines: Array<{ productId: string; quantity: number; productName: string }>,
    returnId: string,
  ): Promise<void> {
    const already = await manager.findOne(InventoryMovement, {
      where: {
        referenceType: 'return_restock',
        referenceId: returnId,
      },
    });
    if (already) {
      return;
    }

    const warehouse = await this.getDefaultWarehouse(manager);
    for (const line of this.orderLines(lines)) {
      let row = await manager.findOne(InventoryStock, {
        where: {
          warehouseId: warehouse.id,
          productId: line.productId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        row = manager.create(InventoryStock, {
          warehouseId: warehouse.id,
          productId: line.productId,
          quantityOnHand: 0,
          quantityReserved: 0,
        });
      }
      row.quantityOnHand += line.quantity;
      await manager.save(row);
      await manager.save(
        manager.create(InventoryMovement, {
          warehouseId: warehouse.id,
          productId: line.productId,
          type: InventoryMovementType.RECEIPT,
          quantityDelta: line.quantity,
          quantityAfter: row.quantityOnHand,
          referenceType: 'return_restock',
          referenceId: returnId,
          note: `Restocked after return inspect (${line.productName})`,
        }),
      );
    }
  }

  /** Idempotent: ensure default warehouse + stock rows for all products. */
  async ensureSeedStock(defaultOnHand = DEFAULT_SEED_ON_HAND): Promise<void> {
    await this.stock.manager.transaction(async (manager) => {
      let warehouse = await manager.findOne(Warehouse, {
        where: { code: DEFAULT_WAREHOUSE_CODE },
      });
      if (!warehouse) {
        warehouse = await manager.save(
          manager.create(Warehouse, {
            code: DEFAULT_WAREHOUSE_CODE,
            name: 'Main warehouse',
            isDefault: true,
            isActive: true,
          }),
        );
      } else if (!warehouse.isDefault) {
        await manager.update(
          Warehouse,
          { isDefault: true },
          { isDefault: false },
        );
        warehouse.isDefault = true;
        warehouse.isActive = true;
        await manager.save(warehouse);
      }

      const products = await manager.find(Product);
      for (const product of products) {
        const existing = await manager.findOne(InventoryStock, {
          where: {
            warehouseId: warehouse.id,
            productId: product.id,
          },
        });
        if (existing) {
          continue;
        }
        const row = await manager.save(
          manager.create(InventoryStock, {
            warehouseId: warehouse.id,
            productId: product.id,
            quantityOnHand: defaultOnHand,
            quantityReserved: 0,
          }),
        );
        await manager.save(
          manager.create(InventoryMovement, {
            warehouseId: warehouse.id,
            productId: product.id,
            type: InventoryMovementType.RECEIPT,
            quantityDelta: defaultOnHand,
            quantityAfter: row.quantityOnHand,
            referenceType: 'seed',
            referenceId: null,
            note: 'Initial stock seed',
          }),
        );
      }
    });
  }
}
