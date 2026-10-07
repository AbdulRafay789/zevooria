import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CreateReturnDto } from '../returns/dto/create-return.dto';
import { ProductReturn } from '../returns/entities/return.entity';
import { ReturnsService } from '../returns/returns.service';
import { AdminGuard, type AdminAuthenticatedRequest } from './admin.guard';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

function toView(row: ProductReturn) {
  return {
    id: row.id,
    orderId: row.orderId,
    orderNumber: row.order?.orderNumber ?? null,
    status: row.status,
    reason: row.reason,
    refundAmount: row.refundAmount,
    createdByAdminId: row.createdByAdminId,
    inspectedAt: row.inspectedAt?.toISOString() ?? null,
    restockedAt: row.restockedAt?.toISOString() ?? null,
    refundedAt: row.refundedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    items: (row.items ?? []).map((item) => ({
      id: item.id,
      orderItemId: item.orderItemId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineRefund: item.lineRefund,
    })),
  };
}

@Controller('admin/returns')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Get()
  @RequirePermissions('returns:read')
  async list() {
    const rows = await this.returns.list();
    return rows.map(toView);
  }

  @Get(':id')
  @RequirePermissions('returns:read')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return toView(await this.returns.getById(id));
  }

  @Post()
  @RequirePermissions('returns:update')
  async create(
    @Req() req: AdminAuthenticatedRequest,
    @Body() body: CreateReturnDto,
  ) {
    const adminId = req.admin?.id;
    if (!adminId) {
      throw new Error('Admin session required.');
    }
    return toView(await this.returns.create(body, adminId));
  }

  @Post(':id/inspect')
  @RequirePermissions('returns:update')
  async inspect(
    @Req() req: AdminAuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const adminId = req.admin?.id;
    if (!adminId) {
      throw new Error('Admin session required.');
    }
    return toView(await this.returns.inspectAndRestock(id, adminId));
  }

  @Post(':id/mark-refunded')
  @RequirePermissions('returns:update')
  async markRefunded(
    @Req() req: AdminAuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const adminId = req.admin?.id;
    if (!adminId) {
      throw new Error('Admin session required.');
    }
    return toView(await this.returns.markRefundPaid(id, adminId));
  }
}
