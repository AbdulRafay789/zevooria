import { Controller, Get, Param } from '@nestjs/common';
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
  currency: string;
  status: string;
  media: ProductMediaResponse[];
};

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async list(): Promise<ProductResponse[]> {
    const products = await this.productsService.findActivePublished();
    return products.map((p) => this.toResponse(p));
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string): Promise<ProductResponse> {
    const product = await this.productsService.findActiveBySlug(slug);
    return this.toResponse(product);
  }

  private toResponse(product: Product): ProductResponse {
    const media = [...(product.media ?? [])].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      currency: product.currency,
      status: product.status,
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
