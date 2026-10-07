import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  auditRequestFromHeaders,
  AuditService,
  clientIpFromRequest,
} from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { AdminGuard, type AdminAuthenticatedRequest } from './admin.guard';
import { UpdateInventoryStockDto } from './dto/update-inventory-stock.dto';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@Controller('admin/inventory')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminInventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions('inventory:read')
  list() {
    return this.inventory.listStockForAdmin();
  }

  @Get('movements')
  @RequirePermissions('inventory:read')
  movements(@Query('limit') limit?: string) {
    const parsed = limit ? Number(limit) : 50;
    return this.inventory.listRecentMovements(
      Number.isFinite(parsed) ? parsed : 50,
    );
  }

  @Patch(':productId')
  @RequirePermissions('inventory:update')
  async update(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() body: UpdateInventoryStockDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const updated = await this.inventory.setQuantityOnHand({
      productId,
      quantityOnHand: body.quantityOnHand,
      note: body.note,
    });
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'inventory.adjust',
      resourceType: 'product',
      resourceId: productId,
      metadata: {
        quantityOnHand: updated.quantityOnHand,
        available: updated.available,
        warehouseCode: updated.warehouseCode,
      },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return updated;
  }
}
