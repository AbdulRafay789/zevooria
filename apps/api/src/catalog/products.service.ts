import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, normalize, resolve, sep } from 'node:path';
import { Repository } from 'typeorm';
import { formatWholePkr, parseWholePkr } from '../common/money/pkr';
import {
  ALLOWED_UPLOAD_IMAGE_EXT,
  MAX_PRODUCT_IMAGE_BYTES,
  detectImageType,
} from '../common/security/image-sniff';
import { resolveAssetsRoot } from './assets-root';
import { MediaType, ProductStatus } from './catalog.enums';
import { Product } from './entities/product.entity';
import { ProductMedia } from './entities/product-media.entity';
import { slugify, uniqueSlug } from './utils/slug.util';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(ProductMedia)
    private readonly media: Repository<ProductMedia>,
  ) {}

  async findActivePublished(): Promise<Product[]> {
    return this.products.find({
      where: { status: ProductStatus.ACTIVE },
      relations: { media: true },
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
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

  async listAllForAdmin(): Promise<Product[]> {
    return this.products.find({
      relations: { media: true },
      order: {
        sortOrder: 'ASC',
        createdAt: 'ASC',
        media: { sortOrder: 'ASC' },
      },
    });
  }

  async findByIdForAdmin(id: string): Promise<Product> {
    const product = await this.products.findOne({
      where: { id },
      relations: { media: true },
      order: { media: { sortOrder: 'ASC' } },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    return product;
  }

  async createForAdmin(input: {
    name: string;
    slug?: string;
    description: string;
    status?: ProductStatus;
    price: string;
    compareAtPrice?: string | null;
    cost?: string;
  }): Promise<Product> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('Name is required.');
    }
    const description = input.description.trim();
    if (!description) {
      throw new BadRequestException('Description is required.');
    }
    let price: string;
    try {
      price = formatWholePkr(parseWholePkr(input.price));
    } catch {
      throw new BadRequestException('Invalid price.');
    }
    let cost = '0.00';
    if (input.cost !== undefined) {
      try {
        cost = formatWholePkr(parseWholePkr(input.cost, 'cost'));
      } catch {
        throw new BadRequestException('Invalid cost.');
      }
    }
    const compareAtPrice = this.parseOptionalCompareAt(
      input.compareAtPrice,
      price,
    );

    const status = input.status ?? ProductStatus.DRAFT;
    if (!Object.values(ProductStatus).includes(status)) {
      throw new BadRequestException('Invalid status.');
    }

    const existingSlugs = new Set(
      (await this.products.find({ select: ['slug'] })).map((row) => row.slug),
    );
    const slug = input.slug?.trim()
      ? uniqueSlug(input.slug.trim(), existingSlugs)
      : uniqueSlug(slugify(name) || 'product', existingSlugs);

    const maxSort = await this.products
      .createQueryBuilder('p')
      .select('COALESCE(MAX(p.sort_order), -1)', 'max')
      .getRawOne<{ max: string }>();
    const sortOrder = Number(maxSort?.max ?? -1) + 1;

    const product = this.products.create({
      name,
      slug,
      description,
      price,
      compareAtPrice,
      cost,
      currency: 'PKR',
      status,
      sortOrder,
    });
    await this.products.save(product);
    return this.findByIdForAdmin(product.id);
  }

  async reorderForAdmin(productIds: string[]): Promise<Product[]> {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw new BadRequestException('productIds are required.');
    }
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('Duplicate product ids are not allowed.');
    }
    const all = await this.products.find({ select: ['id'] });
    if (all.length !== productIds.length) {
      throw new BadRequestException(
        'Reorder list must include every product exactly once.',
      );
    }
    const known = new Set(all.map((row) => row.id));
    for (const id of productIds) {
      if (!known.has(id)) {
        throw new BadRequestException(`Unknown product id: ${id}`);
      }
    }
    await this.products.manager.transaction(async (manager) => {
      for (let index = 0; index < productIds.length; index += 1) {
        await manager.update(
          Product,
          { id: productIds[index] },
          { sortOrder: index },
        );
      }
    });
    return this.listAllForAdmin();
  }

  async updateForAdmin(
    id: string,
    input: {
      status?: ProductStatus;
      price?: string;
      compareAtPrice?: string | null;
      cost?: string;
      description?: string;
    },
  ): Promise<Product> {
    const product = await this.findByIdForAdmin(id);
    if (input.status) {
      if (!Object.values(ProductStatus).includes(input.status)) {
        throw new BadRequestException('Invalid status.');
      }
      product.status = input.status;
    }
    if (input.price !== undefined) {
      try {
        const whole = parseWholePkr(input.price);
        product.price = formatWholePkr(whole);
      } catch {
        throw new BadRequestException('Invalid price.');
      }
    }
    if (input.compareAtPrice !== undefined) {
      product.compareAtPrice = this.parseOptionalCompareAt(
        input.compareAtPrice,
        product.price,
      );
    }
    if (input.cost !== undefined) {
      try {
        const whole = parseWholePkr(input.cost, 'cost');
        product.cost = formatWholePkr(whole);
      } catch {
        throw new BadRequestException('Invalid cost.');
      }
    }
    if (input.description !== undefined) {
      const description = input.description.trim();
      if (!description) {
        throw new BadRequestException('Description cannot be empty.');
      }
      product.description = description;
    }
    await this.products.save(product);
    return this.findByIdForAdmin(id);
  }

  private parseOptionalCompareAt(
    raw: string | null | undefined,
    sellPrice: string,
  ): string | null {
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      return null;
    }
    let compare: number;
    try {
      compare = parseWholePkr(String(raw), 'compare-at price');
    } catch {
      throw new BadRequestException('Invalid compare-at price.');
    }
    const sell = parseWholePkr(sellPrice);
    if (compare <= sell) {
      throw new BadRequestException(
        'Compare-at (previous) price must be greater than the sell price.',
      );
    }
    return formatWholePkr(compare);
  }

  async archiveForAdmin(id: string): Promise<Product> {
    const product = await this.findByIdForAdmin(id);
    if (product.status === ProductStatus.ARCHIVED) {
      return product;
    }
    product.status = ProductStatus.ARCHIVED;
    await this.products.save(product);
    return this.findByIdForAdmin(id);
  }

  async addImageForAdmin(
    id: string,
    input: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      altText?: string;
      isPrimary?: boolean;
    },
  ): Promise<Product> {
    const product = await this.findByIdForAdmin(id);
    if (!input.buffer?.length) {
      throw new BadRequestException('Empty image upload.');
    }
    if (input.buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
      throw new BadRequestException('Image must be 5MB or smaller.');
    }
    // Trust magic bytes, not client MIME or filename.
    const detected = detectImageType(input.buffer);
    if (!detected) {
      throw new BadRequestException(
        'Only JPEG, PNG, or WebP images are allowed.',
      );
    }
    const extFromMime = ALLOWED_UPLOAD_IMAGE_EXT[detected];
    const filename = `${randomUUID()}${extFromMime}`;
    const folder = product.slug;
    let assetsRoot: string;
    try {
      assetsRoot = resolveAssetsRoot();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Assets root missing.';
      throw new BadRequestException(`Cannot store product image: ${message}`);
    }
    const absoluteDir = join(assetsRoot, folder);
    try {
      await mkdir(absoluteDir, { recursive: true });
      await writeFile(join(absoluteDir, filename), input.buffer);
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      if (code === 'EACCES' || code === 'EPERM') {
        throw new BadRequestException(
          'Cannot write product image on the server (assets folder permissions). Fix /app/assets ownership and retry.',
        );
      }
      throw new BadRequestException(
        'Failed to store product image on the server.',
      );
    }

    const storageKey = `assets/${folder}/${filename}`;
    const existing = product.media ?? [];
    const nextSort =
      existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    const makePrimary = input.isPrimary === true || existing.length === 0;
    const altText =
      input.altText?.trim() || `${product.name} image ${existing.length + 1}`;

    await this.media.manager.transaction(async (manager) => {
      if (makePrimary) {
        await manager.update(
          ProductMedia,
          { productId: product.id, isPrimary: true },
          { isPrimary: false },
        );
      }
      await manager.save(
        manager.create(ProductMedia, {
          productId: product.id,
          type: MediaType.IMAGE,
          storageKey,
          altText,
          sortOrder: nextSort,
          isPrimary: makePrimary,
        }),
      );
    });

    return this.findByIdForAdmin(id);
  }

  async removeImageForAdmin(
    productId: string,
    mediaId: string,
  ): Promise<Product> {
    const product = await this.findByIdForAdmin(productId);
    const target = (product.media ?? []).find((row) => row.id === mediaId);
    if (!target) {
      throw new NotFoundException('Product image not found.');
    }

    const wasPrimary = target.isPrimary;
    await this.media.manager.transaction(async (manager) => {
      await manager.delete(ProductMedia, { id: mediaId, productId });
      if (wasPrimary) {
        const remaining = await manager.find(ProductMedia, {
          where: { productId },
          order: { sortOrder: 'ASC' },
        });
        if (remaining[0] && !remaining[0].isPrimary) {
          remaining[0].isPrimary = true;
          await manager.save(remaining[0]);
        }
      }
    });

    await this.tryUnlinkStorageKey(target.storageKey);
    return this.findByIdForAdmin(productId);
  }

  /** Best-effort delete of a file under ASSETS_ROOT; never throws. */
  private async tryUnlinkStorageKey(storageKey: string): Promise<void> {
    try {
      const assetsRoot = resolve(resolveAssetsRoot());
      const relative = storageKey
        .replace(/^assets[/\\]/, '')
        .replace(/^[/\\]+/, '');
      if (!relative || relative.includes('..')) {
        return;
      }
      const absolute = resolve(join(assetsRoot, normalize(relative)));
      const rootWithSep = assetsRoot.endsWith(sep)
        ? assetsRoot
        : `${assetsRoot}${sep}`;
      if (absolute !== assetsRoot && !absolute.startsWith(rootWithSep)) {
        return;
      }
      await unlink(absolute);
    } catch {
      // File may already be missing; DB row is already removed.
    }
  }
}
