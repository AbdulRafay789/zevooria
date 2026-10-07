import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { User } from '../auth/entities/user.entity';
import {
  PaymentProviderName,
  PaymentStatus,
} from '../payments/payment-provider';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { OrderStatus } from './order.enums';
import { OrdersService } from './orders.service';

type OrderItemSummary = {
  productId: string | null;
  productName: string;
  productSlug: string;
  quantity: number;
  imageKey: string | null;
};

type OrderListItemResponse = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  total: string;
  paymentMethod: string;
  paymentStatus: string;
  itemCount: number;
  itemsSummary: OrderItemSummary[];
  createdAt: string;
};

type OrderResponse = {
  id: string;
  orderNumber: string;
  status: string;
  currency: string;
  /** Merchandise total (products only) before promo discount. */
  subtotal: string;
  /** Promo discount applied to merchandise (never to shipping). */
  discountAmount: string;
  promoCode: string | null;
  /** Delivery / shipping charges. */
  shippingAmount: string;
  /** Grand total = subtotal - discount + shipping. */
  total: string;
  /** Alias of subtotal — merchandise exclusive of charges. */
  totalExclusiveAmount: string;
  /** Alias of shippingAmount — delivery/other charges. */
  totalCharges: string;
  /** Alias of total — net amount payable. */
  totalNetAmount: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  canCancel: boolean;
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

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest & { user: User },
    @Body() body: CreateOrderDto,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ): Promise<OrderResponse> {
    const idempotencyKey =
      body.idempotencyKey?.trim() || idempotencyHeader?.trim() || undefined;
    const order = await this.ordersService.create(req.user, {
      ...body,
      idempotencyKey,
    });
    return this.toDetailResponse(order);
  }

  @Get()
  async list(
    @Req() req: AuthenticatedRequest & { user: User },
  ): Promise<OrderListItemResponse[]> {
    const orders = await this.ordersService.listForUser(req.user.id);
    const imageMap = await this.ordersService.primaryImageKeysForOrders(orders);
    return orders.map((order) => this.toListResponse(order, imageMap));
  }

  @Get(':id')
  async getOne(
    @Req() req: AuthenticatedRequest & { user: User },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<OrderResponse> {
    const order = await this.ordersService.findForUser(req.user.id, id);
    return this.toDetailResponse(order);
  }

  @Post(':id/cancel')
  async cancel(
    @Req() req: AuthenticatedRequest & { user: User },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<OrderResponse> {
    const order = await this.ordersService.cancelForCustomer(req.user.id, id);
    return this.toDetailResponse(order);
  }

  private primaryPayment(order: Order) {
    return [...(order.payments ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )[0];
  }

  private toListResponse(
    order: Order,
    imageMap: Map<string, string>,
  ): OrderListItemResponse {
    const payment = this.primaryPayment(order);
    const items = order.items ?? [];
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      total: order.total,
      paymentMethod: payment?.provider ?? PaymentProviderName.COD,
      paymentStatus: payment?.status ?? PaymentStatus.PENDING,
      itemCount,
      itemsSummary: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productSlug: item.productSlug,
        quantity: item.quantity,
        imageKey: item.productId
          ? (imageMap.get(item.productId) ?? null)
          : null,
      })),
      createdAt: order.createdAt.toISOString(),
    };
  }

  private async toDetailResponse(order: Order): Promise<OrderResponse> {
    const payment = this.primaryPayment(order);
    const imageMap = await this.ordersService.primaryImageKeysForOrders([
      order,
    ]);
    const statusHistory = await this.ordersService.listStatusHistory(order.id);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount ?? '0.00',
      promoCode: order.promoCode,
      shippingAmount: order.shippingAmount,
      total: order.total,
      totalExclusiveAmount: order.subtotal,
      totalCharges: order.shippingAmount,
      totalNetAmount: order.total,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      paymentMethod: payment?.provider ?? PaymentProviderName.COD,
      paymentStatus: payment?.status ?? PaymentStatus.PENDING,
      createdAt: order.createdAt.toISOString(),
      canCancel: order.status === OrderStatus.PLACED,
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
