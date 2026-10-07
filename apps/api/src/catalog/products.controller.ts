import { Controller, Get, Param } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';

type ProductMediaResponse = {
  id: string;
  type: string;
  storageKey: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
};

type ProductResponse = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  status: string;
  sortOrder: number;
  availableQuantity: number;
  media: ProductMediaResponse[];
};

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly inventoryService: InventoryService,
  ) {}

  @Get()
  async list(): Promise<ProductResponse[]> {
    const products = await this.productsService.findActivePublished();
    const available =
      await this.inventoryService.getStorefrontAvailableQuantities(
        products.map((p) => p.id),
      );
    return products.map((p) => this.toResponse(p, available.get(p.id) ?? 0));
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string): Promise<ProductResponse> {
    const product = await this.productsService.findActiveBySlug(slug);
    const available =
      await this.inventoryService.getStorefrontAvailableQuantities([
        product.id,
      ]);
    return this.toResponse(product, available.get(product.id) ?? 0);
  }

  private toResponse(
    product: Product,
    availableQuantity: number,
  ): ProductResponse {
    const media = [...(product.media ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      currency: product.currency,
      status: product.status,
      sortOrder: product.sortOrder,
      availableQuantity,
      media: media.map((m) => ({
        id: m.id,
        type: m.type,
        storageKey: m.storageKey,
        altText: m.altText,
        sortOrder: m.sortOrder,
        isPrimary: m.isPrimary,
      })),
    };
  }
}
