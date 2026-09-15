import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductStatus } from './catalog.enums';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  async findActivePublished(): Promise<Product[]> {
    return this.products.find({
      where: { status: ProductStatus.ACTIVE },
      relations: { media: true },
      order: {
        name: 'ASC',
        media: { sortOrder: 'ASC' },
      },
    });
  }

  async findActiveBySlug(slug: string): Promise<Product> {
    const product = await this.products.findOne({
      where: { slug, status: ProductStatus.ACTIVE },
      relations: { media: true },
      order: { media: { sortOrder: 'ASC' } },
    });

    if (!product) {
      throw new NotFoundException(`Product not found: ${slug}`);
    }

    return product;
  }
}
