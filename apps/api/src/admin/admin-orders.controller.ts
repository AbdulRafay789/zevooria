import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  auditRequestFromHeaders,
  AuditService,
  clientIpFromRequest,
} from '../audit/audit.service';
import {
  PaymentProviderName,
  PaymentStatus,
} from '../payments/payment-provider';
import { Order } from '../orders/entities/order.entity';
import { ORDER_STATUS_TRANSITIONS, OrderStatus } from '../orders/order.enums';
import { OrdersService } from '../orders/orders.service';
import { AdminGuard, type AdminAuthenticatedRequest } from './admin.guard';
import { UpdateAdminOrderStatusDto } from './dto/update-admin-order-status.dto';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

type AdminOrderListItem = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  total: string;
  customerName: string;
  customerEmail: string;
  paymentMethod: string;
  paymentStatus: string;
  itemCount: number;
  createdAt: string;
};

type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  allowedNextStatuses: OrderStatus[];
  currency: string;
  subtotal: string;
  discountAmount: string;
  promoCode: string | null;
  discountApplied: boolean;
  shippingAmount: string;
  total: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  statusHistory: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    actorType: string;
    actorId: string | null;
    note: string | null;
    createdAt: string;
  }>;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    productSlug: string;
    unitPrice: string;
    quantity: number;
    lineTotal: string;
    imageKey: string | null;
  }>;
  shippingAddress: {
    line1: string;
    line2: string | null;
    city: string;
    postalCode: string;
    country: string;
  };
};

@Controller('admin/orders')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions('orders:read')
  async list(): Promise<AdminOrderListItem[]> {
    const orders = await this.ordersService.listAll();
    return orders.map((order) => this.toListResponse(order));
  }

  @Get(':id')
  @RequirePermissions('orders:read')
  async getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminOrderDetail> {
    const order = await this.ordersService.findById(id);
    return await this.toDetailResponse(order);
  }

  @Patch(':id/status')
  @RequirePermissions('orders:update')
  async updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateAdminOrderStatusDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ): Promise<AdminOrderDetail> {
    const before = await this.ordersService.findById(id);
    const order = await this.ordersService.updateStatus(id, body.status, {
      type: 'admin',
      id: req.admin?.id ?? null,
    });
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'order.status_update',
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        from: before.status,
        to: order.status,
        orderNumber: order.orderNumber,
      },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return await this.toDetailResponse(order);
  }

  @Delete(':id')
  @RequirePermissions('orders:update')
  async deleteOrder(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & AdminAuthenticatedRequest,
  ): Promise<AdminOrderDetail> {
    const before = await this.ordersService.findById(id);
    const order = await this.ordersService.adminDeleteOrder(id, {
      type: 'admin',
      id: req.admin?.id ?? null,
      note: 'Deleted by admin',
    });
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'order.delete',
      resourceType: 'order',
      resourceId: order.id,
      metadata: {
        from: before.status,
        to: order.status,
        orderNumber: order.orderNumber,
      },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return await this.toDetailResponse(order);
  }

  private primaryPayment(order: Order) {
    return [...(order.payments ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )[0];
  }

  private toListResponse(order: Order): AdminOrderListItem {
    const payment = this.primaryPayment(order);
    const items = order.items ?? [];
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      total: order.total,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      paymentMethod: payment?.provider ?? PaymentProviderName.COD,
      paymentStatus: payment?.status ?? PaymentStatus.PENDING,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt.toISOString(),
    };
  }

  private async toDetailResponse(order: Order): Promise<AdminOrderDetail> {
    const payment = this.primaryPayment(order);
    const imageMap = await this.ordersService.primaryImageKeysForOrders([
      order,
    ]);
    const statusHistory = await this.ordersService.listStatusHistory(order.id);

    const discountAmount = order.discountAmount ?? '0.00';
    const discountApplied =
      Boolean(order.promoCode) ||
      Number.parseInt(discountAmount.split('.')[0] ?? '0', 10) > 0;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      allowedNextStatuses: ORDER_STATUS_TRANSITIONS[order.status] ?? [],
      currency: order.currency,
      subtotal: order.subtotal,
      discountAmount,
      promoCode: order.promoCode ?? null,
      discountApplied,
      shippingAmount: order.shippingAmount,
      total: order.total,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      paymentMethod: payment?.provider ?? PaymentProviderName.COD,
      paymentStatus: payment?.status ?? PaymentStatus.PENDING,
      createdAt: order.createdAt.toISOString(),
      statusHistory,
      items: (order.items ?? []).map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        imageKey: item.productId
          ? (imageMap.get(item.productId) ?? null)
          : null,
      })),
      shippingAddress: {
        line1: order.shippingAddress.line1,
        line2: order.shippingAddress.line2,
        city: order.shippingAddress.city,
        postalCode: order.shippingAddress.postalCode,
        country: order.shippingAddress.country,
      },
    };
  }
}
