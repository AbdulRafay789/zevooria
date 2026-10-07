import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  auditRequestFromHeaders,
  AuditService,
  clientIpFromRequest,
} from '../audit/audit.service';
import { PromoDiscountType } from '../promotions/promo-discount.enums';
import { PromoCodesService } from '../promotions/promo-codes.service';
import { AdminGuard, type AdminAuthenticatedRequest } from './admin.guard';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

class CreatePromoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code!: string;

  @IsEnum(PromoDiscountType)
  discountType!: PromoDiscountType;

  @IsString()
  @Matches(/^\d+(\.0{1,2})?$/, {
    message: 'discountValue must be a whole PKR or percent amount',
  })
  discountValue!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.0{1,2})?$/)
  minSubtotal?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxUses?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdatePromoDto {
  @IsOptional()
  @IsEnum(PromoDiscountType)
  discountType?: PromoDiscountType;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.0{1,2})?$/)
  discountValue?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.0{1,2})?$/)
  minSubtotal?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  maxUses?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  startsAt?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('admin/promo-codes')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminPromoCodesController {
  constructor(
    private readonly promoCodes: PromoCodesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions('promotions:read')
  async list() {
    const rows = await this.promoCodes.listAll();
    return rows.map((row) => this.toView(row));
  }

  @Post()
  @RequirePermissions('promotions:update')
  async create(
    @Body() body: CreatePromoDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const row = await this.promoCodes.create(body);
    try {
      await this.auditService.record({
        actorType: 'admin',
        actorId: req.admin?.id ?? null,
        action: 'promo.create',
        resourceType: 'promo_code',
        resourceId: row.id,
        metadata: { code: row.code, discountType: row.discountType },
        request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
      });
    } catch {
      // Audit must not fail the create response.
    }
    return this.toView(row);
  }

  @Patch(':id')
  @RequirePermissions('promotions:update')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdatePromoDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const row = await this.promoCodes.update(id, body);
    try {
      await this.auditService.record({
        actorType: 'admin',
        actorId: req.admin?.id ?? null,
        action: 'promo.update',
        resourceType: 'promo_code',
        resourceId: row.id,
        metadata: { code: row.code, isActive: row.isActive },
        request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
      });
    } catch {
      // Audit must not fail the update response.
    }
    return this.toView(row);
  }

  @Delete(':id')
  @RequirePermissions('promotions:update')
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const before = await this.promoCodes.findById(id);
    await this.promoCodes.remove(id);
    try {
      await this.auditService.record({
        actorType: 'admin',
        actorId: req.admin?.id ?? null,
        action: 'promo.delete',
        resourceType: 'promo_code',
        resourceId: before.id,
        metadata: { code: before.code, usedCount: before.usedCount },
        request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
      });
    } catch {
      // Audit must not fail the delete response.
    }
    return { ok: true };
  }

  private toView(row: {
    id: string;
    code: string;
    discountType: PromoDiscountType;
    discountValue: string;
    minSubtotal: string;
    maxUses: number | null;
    usedCount: number;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      code: row.code,
      discountType: row.discountType,
      discountValue: row.discountValue,
      minSubtotal: row.minSubtotal,
      maxUses: row.maxUses,
      usedCount: row.usedCount,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
