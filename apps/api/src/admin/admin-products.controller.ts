import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import {
  auditRequestFromHeaders,
  AuditService,
  clientIpFromRequest,
} from '../audit/audit.service';
import { Product } from '../catalog/entities/product.entity';
import { ProductQrService } from '../catalog/product-qr.service';
import { ProductsService } from '../catalog/products.service';
import { AdminGuard, type AdminAuthenticatedRequest } from './admin.guard';
import { UpdateAdminProductDto } from './dto/update-admin-product.dto';
import {
  CreateAdminProductDto,
  ReorderAdminProductsDto,
} from './dto/create-admin-product.dto';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

type UploadedImageFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

@Controller('admin/products')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productQrService: ProductQrService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions('products:read')
  async list() {
    const products = await this.productsService.listAllForAdmin();
    return products.map((product) => this.toAdminProduct(product));
  }

  @Post()
  @RequirePermissions('products:update')
  async create(
    @Body() body: CreateAdminProductDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const product = await this.productsService.createForAdmin(body);
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'product.create',
      resourceType: 'product',
      resourceId: product.id,
      metadata: {
        slug: product.slug,
        status: product.status,
        price: product.price,
      },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return this.toAdminProduct(product);
  }

  @Patch('reorder')
  @RequirePermissions('products:update')
  async reorder(
    @Body() body: ReorderAdminProductsDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const products = await this.productsService.reorderForAdmin(
      body.productIds,
    );
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'product.reorder',
      resourceType: 'product',
      resourceId: null,
      metadata: { count: products.length },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return products.map((product) => this.toAdminProduct(product));
  }

  @Get(':id')
  @RequirePermissions('products:read')
  async getOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const product = await this.productsService.findByIdForAdmin(id);
    return this.toAdminProduct(product);
  }

  @Get(':id/qr')
  @RequirePermissions('products:read')
  async qrMeta(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const product = await this.productsService.findByIdForAdmin(id);
    const url = this.productQrService.productUrl(product.slug);
    return {
      productId: product.id,
      name: product.name,
      slug: product.slug,
      url,
      downloadPath: `/admin/products/${product.id}/qr.png`,
    };
  }

  @Get(':id/qr.png')
  @RequirePermissions('products:read')
  @Header('Cache-Control', 'private, max-age=300')
  async qrPng(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('size') sizeRaw: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const product = await this.productsService.findByIdForAdmin(id);
    const parsed = sizeRaw ? Number(sizeRaw) : 512;
    const size = Number.isFinite(parsed) ? parsed : 512;
    const buffer = await this.productQrService.pngBuffer(product.slug, size);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="zevooria-${product.slug}-qr.png"`,
    );
    return new StreamableFile(buffer);
  }

  @Get(':id/qr-sheet')
  @RequirePermissions('products:read')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async qrSheet(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('copies') copiesRaw: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const product = await this.productsService.findByIdForAdmin(id);
    const parsed = copiesRaw ? Number(copiesRaw) : 12;
    const copies = Math.min(
      Math.max(Number.isFinite(parsed) ? parsed : 12, 1),
      48,
    );
    const url = this.productQrService.productUrl(product.slug);
    const png = await this.productQrService.pngBuffer(product.slug, 360);
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
    const cells = Array.from({ length: copies }, (_, index) => index)
      .map(
        () => `
      <figure class="cell">
        <img src="${dataUrl}" alt="QR for ${escapeHtml(product.name)}" />
        <figcaption>
          <strong>${escapeHtml(product.name)}</strong>
          <span>${escapeHtml(product.slug)}</span>
        </figcaption>
      </figure>`,
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Zevooria QR — ${escapeHtml(product.name)}</title>
  <style>
    @page { margin: 12mm; }
    body { font-family: Georgia, serif; color: #1c1915; margin: 0; padding: 16px; }
    h1 { font-size: 18px; font-weight: 400; letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #666; margin: 0 0 16px; word-break: break-all; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .cell { margin: 0; border: 1px solid #ddd; padding: 10px; text-align: center; break-inside: avoid; }
    .cell img { width: 120px; height: 120px; }
    figcaption { margin-top: 8px; display: grid; gap: 2px; }
    figcaption strong { font-size: 12px; }
    figcaption span { font-size: 10px; color: #777; letter-spacing: 0.04em; }
    .actions { margin-bottom: 16px; }
    @media print { .actions { display: none; } }
  </style>
</head>
<body>
  <div class="actions">
    <button type="button" onclick="window.print()">Print sheet</button>
  </div>
  <h1>Zevooria box QR</h1>
  <p class="meta">${escapeHtml(url)}</p>
  <div class="grid">${cells}</div>
</body>
</html>`;
    res.send(html);
  }

  @Delete(':id')
  @RequirePermissions('products:update')
  async archive(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const product = await this.productsService.archiveForAdmin(id);
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'product.archive',
      resourceType: 'product',
      resourceId: product.id,
      metadata: {
        slug: product.slug,
        status: product.status,
      },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return this.toAdminProduct(product);
  }

  @Patch(':id')
  @RequirePermissions('products:update')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateAdminProductDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const before = await this.productsService.findByIdForAdmin(id);
    const product = await this.productsService.updateForAdmin(id, body);
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'product.update',
      resourceType: 'product',
      resourceId: product.id,
      metadata: {
        slug: product.slug,
        before: {
          status: before.status,
          price: before.price,
          cost: before.cost,
          descriptionChanged: body.description !== undefined,
        },
        after: {
          status: product.status,
          price: product.price,
          cost: product.cost,
          descriptionChanged: body.description !== undefined,
        },
      },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return this.toAdminProduct(product);
  }

  @Post(':id/media')
  @RequirePermissions('products:update')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadMedia(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Body() body: { altText?: string; isPrimary?: string },
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Image file is required.');
    }
    const product = await this.productsService.addImageForAdmin(id, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      altText: body.altText,
      isPrimary: body.isPrimary === 'true' || body.isPrimary === '1',
    });
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'product.media.upload',
      resourceType: 'product',
      resourceId: product.id,
      metadata: {
        slug: product.slug,
        mediaCount: product.media?.length ?? 0,
      },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return this.toAdminProduct(product);
  }

  @Delete(':id/media/:mediaId')
  @RequirePermissions('products:update')
  async removeMedia(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('mediaId', new ParseUUIDPipe({ version: '4' })) mediaId: string,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const product = await this.productsService.removeImageForAdmin(id, mediaId);
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'product.media.remove',
      resourceType: 'product',
      resourceId: product.id,
      metadata: {
        slug: product.slug,
        mediaId,
        mediaCount: product.media?.length ?? 0,
      },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return this.toAdminProduct(product);
  }

  private toAdminProduct(product: Product) {
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
      cost: product.cost,
      currency: product.currency,
      status: product.status,
      sortOrder: product.sortOrder,
      productPageUrl: this.productQrService.productUrl(product.slug),
      updatedAt: product.updatedAt.toISOString(),
      media: media.map((row) => ({
        id: row.id,
        type: row.type,
        storageKey: row.storageKey,
        altText: row.altText,
        sortOrder: row.sortOrder,
        isPrimary: row.isPrimary,
      })),
    };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
