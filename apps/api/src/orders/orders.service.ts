import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { MediaType, ProductStatus } from '../catalog/catalog.enums';
import { Product } from '../catalog/entities/product.entity';
import { ProductMedia } from '../catalog/entities/product-media.entity';
import {
  formatWholePkr,
  lineTotalWholePkr,
  parseWholePkr,
  sumWholePkr,
} from '../common/money/pkr';
import { shippingPkrForCity } from '../common/shipping/shipping-rates';
import {
  PaymentProviderName,
  PaymentStatus,
} from '../payments/payment-provider';
import { PaymentService } from '../payments/payment.service';
import { InventoryService } from '../inventory/inventory.service';
import { AccountingService } from '../accounting/accounting.service';
import { AdminNotificationsService } from '../admin/admin-notifications.service';
import { AuditService } from '../audit/audit.service';
import { CustomerEmailService } from '../notifications/customer-email.service';
import { PromoCodesService } from '../promotions/promo-codes.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderAddress } from './entities/order-address.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import {
  OrderStatusHistory,
  type OrderStatusActorType,
} from './entities/order-status-history.entity';
import { Payment } from './entities/payment.entity';
import { ORDER_STATUS_TRANSITIONS, OrderStatus } from './order.enums';

const MAX_QTY_PER_LINE = 20;

export type StatusChangeActor = {
  type: OrderStatusActorType;
  id?: string | null;
  note?: string | null;
};

export type OrderStatusHistoryView = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
  actorId: string | null;
  note: string | null;
  createdAt: string;
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly paymentService: PaymentService,
    private readonly inventoryService: InventoryService,
    private readonly accountingService: AccountingService,
    private readonly adminNotifications: AdminNotificationsService,
    private readonly auditService: AuditService,
    private readonly promoCodes: PromoCodesService,
    private readonly customerEmail: CustomerEmailService,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(ProductMedia)
    private readonly media: Repository<ProductMedia>,
    @InjectRepository(OrderStatusHistory)
    private readonly statusHistory: Repository<OrderStatusHistory>,
  ) {}

  async create(user: User, dto: CreateOrderDto): Promise<Order> {
    if (dto.paymentMethod !== PaymentProviderName.COD) {
      throw new BadRequestException(
        'Only Cash on Delivery (COD) is available in this release.',
      );
    }

    if (dto.idempotencyKey) {
      const existing = await this.orders.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
        relations: {
          items: true,
          shippingAddress: true,
          payments: true,
        },
      });
      if (existing) {
        if (existing.userId !== user.id) {
          throw new BadRequestException('Invalid idempotency key.');
        }
        return existing;
      }
    }

    const productIds = dto.items.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      throw new BadRequestException('Duplicate product lines are not allowed.');
    }

    let isNewOrder = false;
    const created = await this.dataSource.transaction(async (manager) => {
      if (dto.idempotencyKey) {
        const raced = await manager.findOne(Order, {
          where: { idempotencyKey: dto.idempotencyKey },
          relations: {
            items: true,
            shippingAddress: true,
            payments: true,
          },
        });
        if (raced) {
          return raced;
        }
      }

      const products = await manager.find(Product, {
        where: { id: In(productIds) },
      });
      const byId = new Map(products.map((product) => [product.id, product]));

      const lineSnapshots: Array<{
        product: Product;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }> = [];

      for (const line of dto.items) {
        const product = byId.get(line.productId);
        if (!product) {
          throw new BadRequestException(`Product not found: ${line.productId}`);
        }
        if (product.status !== ProductStatus.ACTIVE) {
          throw new BadRequestException(
            `Product is not available: ${product.name}`,
          );
        }
        if (
          !Number.isInteger(line.quantity) ||
          line.quantity < 1 ||
          line.quantity > MAX_QTY_PER_LINE
        ) {
          throw new BadRequestException(
            `Invalid quantity for ${product.name}.`,
          );
        }

        const unitPrice = parseWholePkr(product.price, product.name);
        const lineTotal = lineTotalWholePkr(unitPrice, line.quantity);
        lineSnapshots.push({
          product,
          quantity: line.quantity,
          unitPrice,
          lineTotal,
        });
      }

      const subtotal = sumWholePkr(lineSnapshots.map((line) => line.lineTotal));
      const shippingAmount = shippingPkrForCity(dto.shippingAddress.city);

      let discountAmount = 0;
      let promoCodeId: string | null = null;
      let promoCodeSnapshot: string | null = null;
      if (dto.promoCode?.trim()) {
        const validated = await this.promoCodes.validateForSubtotal(
          dto.promoCode,
          subtotal,
        );
        discountAmount = validated.discountAmount;
        promoCodeId = validated.promo.id;
        promoCodeSnapshot = validated.promo.code;
      }

      const merchandiseNet = Math.max(0, subtotal - discountAmount);
      const total = sumWholePkr([merchandiseNet, shippingAmount]);

      const order = manager.create(Order, {
        orderNumber: this.createOrderNumber(),
        userId: user.id,
        status: OrderStatus.PLACED,
        currency: 'PKR',
        subtotal: formatWholePkr(subtotal),
        discountAmount: formatWholePkr(discountAmount),
        promoCodeId,
        promoCode: promoCodeSnapshot,
        shippingAmount: formatWholePkr(shippingAmount),
        total: formatWholePkr(total),
        customerName: dto.customerName.trim(),
        customerEmail: dto.customerEmail.trim().toLowerCase(),
        customerPhone: dto.customerPhone.trim(),
        idempotencyKey: dto.idempotencyKey?.trim() || null,
      });
      await manager.save(order);

      if (promoCodeId) {
        await this.promoCodes.consumeUse(manager, promoCodeId);
      }

      const items = lineSnapshots.map((line) =>
        manager.create(OrderItem, {
          orderId: order.id,
          productId: line.product.id,
          productName: line.product.name,
          productSlug: line.product.slug,
          unitPrice: formatWholePkr(line.unitPrice),
          quantity: line.quantity,
          lineTotal: formatWholePkr(line.lineTotal),
        }),
      );
      await manager.save(items);

      await this.inventoryService.reserveForOrder(
        manager,
        lineSnapshots.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          productName: line.product.name,
        })),
        order.id,
      );

      const address = manager.create(OrderAddress, {
        orderId: order.id,
        line1: dto.shippingAddress.line1.trim(),
        line2: dto.shippingAddress.line2?.trim() || null,
        city: dto.shippingAddress.city.trim(),
        postalCode: dto.shippingAddress.postalCode.trim(),
        country: (dto.shippingAddress.country ?? 'Pakistan').trim(),
      });
      await manager.save(address);

      const paymentResult = await this.paymentService.createPayment(
        PaymentProviderName.COD,
        {
          orderId: order.id,
          amountPkr: total,
          currency: 'PKR',
        },
      );

      const payment = manager.create(Payment, {
        orderId: order.id,
        provider: paymentResult.provider,
        status: paymentResult.status,
        amount: formatWholePkr(total),
        currency: 'PKR',
        providerReference: paymentResult.providerReference,
      });
      await manager.save(payment);

      await manager.save(
        manager.create(OrderStatusHistory, {
          orderId: order.id,
          fromStatus: null,
          toStatus: OrderStatus.PLACED,
          actorType: 'customer',
          actorId: user.id,
          note: 'Order placed',
        }),
      );

      const created = await manager.findOne(Order, {
        where: { id: order.id },
        relations: {
          items: true,
          shippingAddress: true,
          payments: true,
        },
      });
      if (!created) {
        throw new BadRequestException(
          'Order could not be loaded after create.',
        );
      }
      isNewOrder = true;
      return created;
    });

    if (isNewOrder) {
      try {
        await this.adminNotifications.notifyOrderPlaced({
          orderId: created.id,
          orderNumber: created.orderNumber,
          customerName: created.customerName,
          totalPkr: created.total,
        });
      } catch {
        // Notification failures must not fail order placement.
      }
      try {
        const messageId = await this.customerEmail.sendOrderPlaced({
          to: created.customerEmail,
          customerName: created.customerName,
          orderId: created.id,
          orderNumber: created.orderNumber,
          totalPkr: created.total,
          currency: created.currency,
          paymentMethod: created.payments?.[0]?.provider ?? 'cod',
          items: (created.items ?? []).map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
          })),
        });
        if (messageId) {
          this.logger.log(
            `Order confirmation email accepted order=${created.orderNumber} to=${created.customerEmail} bcc=abdulrafaydeveloper@outlook.com,saad.jabri.iftikhar@gmail.com messageId=${messageId}`,
          );
        }
      } catch (err) {
        // Customer email failures must not fail order placement.
        const name =
          err && typeof err === 'object' && 'name' in err
            ? String((err as { name: unknown }).name)
            : 'Error';
        const message =
          err instanceof Error
            ? err.message
            : err && typeof err === 'object' && 'message' in err
              ? String((err as { message: unknown }).message)
              : String(err);
        this.logger.warn(
          `Order confirmation email failed order=${created.orderNumber} to=${created.customerEmail} error=${name}: ${message}`,
        );
      }
      await this.auditService.record({
        actorType: 'customer',
        actorId: user.id,
        action: 'order.placed',
        resourceType: 'order',
        resourceId: created.id,
        metadata: {
          orderNumber: created.orderNumber,
          total: created.total,
          currency: created.currency,
          itemCount: created.items?.length ?? 0,
        },
      });
    }
    return created;
  }

  async findForUser(userId: string, orderId: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id: orderId, userId },
      relations: {
        items: true,
        shippingAddress: true,
        payments: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    return order;
  }

  async listForUser(userId: string): Promise<Order[]> {
    return this.orders.find({
      where: { userId },
      relations: {
        items: true,
        payments: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** Admin: all orders, newest first. */
  async listAll(): Promise<Order[]> {
    return this.orders.find({
      relations: {
        items: true,
        payments: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /** Admin: order by UUID regardless of customer ownership. */
  async findById(orderId: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id: orderId },
      relations: {
        items: true,
        shippingAddress: true,
        payments: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    return order;
  }

  async listStatusHistory(orderId: string): Promise<OrderStatusHistoryView[]> {
    const rows = await this.statusHistory.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.id,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      actorType: row.actorType,
      actorId: row.actorId,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async updateStatus(
    orderId: string,
    next: OrderStatus,
    actor: StatusChangeActor = { type: 'system' },
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      // Lock the order row alone — Postgres rejects FOR UPDATE with LEFT JOINs
      // (TypeORM uses outer joins when loading relations).
      const locked = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException('Order not found.');
      }
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: {
          items: true,
          shippingAddress: true,
          payments: true,
        },
      });
      if (!order) {
        throw new NotFoundException('Order not found.');
      }
      const allowed = ORDER_STATUS_TRANSITIONS[order.status] ?? [];
      if (!allowed.includes(next)) {
        throw new BadRequestException(
          `Cannot transition order from ${order.status} to ${next}.`,
        );
      }
      const fromStatus = order.status;
      const stockLines = (order.items ?? [])
        .filter((item) => Boolean(item.productId))
        .map((item) => ({
          productId: item.productId as string,
          quantity: item.quantity,
          productName: item.productName,
        }));
      if (next === OrderStatus.CANCELLED) {
        await this.inventoryService.releaseOrRestoreOnCancel(
          manager,
          stockLines,
          order.id,
        );
        await this.accountingService.reverseOrderJournals(order, manager);
      }
      if (next === OrderStatus.PROCESSING || next === OrderStatus.SHIPPED) {
        await this.inventoryService.consumeReservedForSale(
          manager,
          stockLines,
          order.id,
        );
        await this.accountingService.postOrderConfirm(order, manager);
      }
      if (next === OrderStatus.DELIVERED) {
        await this.accountingService.postOrderDelivered(order, manager);
        // COD cash is collected at delivery — mark payment success.
        for (const payment of order.payments ?? []) {
          if (
            payment.provider === PaymentProviderName.COD &&
            payment.status !== PaymentStatus.SUCCESS
          ) {
            payment.status = PaymentStatus.SUCCESS;
            await manager.save(payment);
          }
        }
      }
      order.status = next;
      await manager.save(order);
      await manager.save(
        manager.create(OrderStatusHistory, {
          orderId: order.id,
          fromStatus,
          toStatus: next,
          actorType: actor.type,
          actorId: actor.id ?? null,
          note: actor.note?.trim() || null,
        }),
      );
      const updated = await manager.findOne(Order, {
        where: { id: order.id },
        relations: {
          items: true,
          shippingAddress: true,
          payments: true,
        },
      });
      if (!updated) {
        throw new NotFoundException('Order not found.');
      }
      return updated;
    });
  }

  async cancelForCustomer(userId: string, orderId: string): Promise<Order> {
    const order = await this.findForUser(userId, orderId);
    if (order.status !== OrderStatus.PLACED) {
      throw new BadRequestException(
        'Only orders in placed status can be cancelled by the customer.',
      );
    }
    return this.updateStatus(orderId, OrderStatus.CANCELLED, {
      type: 'customer',
      id: userId,
      note: 'Cancelled by customer',
    });
  }

  /**
   * Admin delete voids an order from any non-cancelled status (including delivered):
   * restores inventory and posts reversing journals (idempotent).
   */
  async adminDeleteOrder(
    orderId: string,
    actor: StatusChangeActor = { type: 'admin' },
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(Order, {
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException('Order not found.');
      }
      const order = await manager.findOne(Order, {
        where: { id: orderId },
        relations: {
          items: true,
          shippingAddress: true,
          payments: true,
        },
      });
      if (!order) {
        throw new NotFoundException('Order not found.');
      }
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Order is already cancelled.');
      }

      const fromStatus = order.status;
      const stockLines = (order.items ?? [])
        .filter((item) => Boolean(item.productId))
        .map((item) => ({
          productId: item.productId as string,
          quantity: item.quantity,
          productName: item.productName,
        }));

      await this.inventoryService.releaseOrRestoreOnCancel(
        manager,
        stockLines,
        order.id,
      );
      await this.accountingService.reverseOrderJournals(order, manager);

      for (const payment of order.payments ?? []) {
        if (payment.status === PaymentStatus.SUCCESS) {
          payment.status = PaymentStatus.REFUNDED;
          await manager.save(payment);
        } else if (
          payment.status === PaymentStatus.PENDING ||
          payment.status === PaymentStatus.CREATED ||
          payment.status === PaymentStatus.PROCESSING
        ) {
          payment.status = PaymentStatus.FAILED;
          await manager.save(payment);
        }
      }

      order.status = OrderStatus.CANCELLED;
      await manager.save(order);
      await manager.save(
        manager.create(OrderStatusHistory, {
          orderId: order.id,
          fromStatus,
          toStatus: OrderStatus.CANCELLED,
          actorType: actor.type,
          actorId: actor.id ?? null,
          note: actor.note?.trim() || 'Deleted by admin',
        }),
      );

      const updated = await manager.findOne(Order, {
        where: { id: order.id },
        relations: {
          items: true,
          shippingAddress: true,
          payments: true,
        },
      });
      if (!updated) {
        throw new NotFoundException('Order not found.');
      }
      return updated;
    });
  }

  async dashboardStats(
    options: {
      from?: string;
      to?: string;
      status?: string;
    } = {},
  ): Promise<{
    ordersToday: number;
    ordersPending: number;
    ordersTotal: number;
    revenueTodayPkr: string;
    revenueTotalPkr: string;
    from: string | null;
    to: string | null;
    status: string | null;
    filteredOrders: number;
    filteredRevenuePkr: string;
    profitAndLoss: {
      totalRevenue: string;
      totalExpenses: string;
      netIncome: string;
    };
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const fromRaw = options.from?.trim() || '';
    const toRaw = options.to?.trim() || '';
    const statusRaw = options.status?.trim() || '';

    if (fromRaw && !/^\d{4}-\d{2}-\d{2}$/.test(fromRaw)) {
      throw new BadRequestException('from must be YYYY-MM-DD.');
    }
    if (toRaw && !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
      throw new BadRequestException('to must be YYYY-MM-DD.');
    }

    let statusFilter: OrderStatus | null = null;
    if (statusRaw) {
      const allowed = Object.values(OrderStatus) as string[];
      if (!allowed.includes(statusRaw)) {
        throw new BadRequestException('Invalid order status filter.');
      }
      statusFilter = statusRaw as OrderStatus;
    }

    const fromDate = fromRaw ? startOfUtcDay(fromRaw) : null;
    const toDate = toRaw ? endOfUtcDay(toRaw) : null;
    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('from must be on or before to.');
    }

    const ordersTotal = await this.orders.count();
    const ordersToday = await this.orders.count({
      where: { createdAt: MoreThanOrEqual(startOfDay) },
    });

    const ordersPending = await this.orders.count({
      where: {
        status: In([OrderStatus.PLACED, OrderStatus.PROCESSING]),
      },
    });

    const revenueTotalRow = await this.orders
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total), 0)', 'sum')
      .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .getRawOne<{ sum: string }>();

    const revenueTodayRow = await this.orders
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total), 0)', 'sum')
      .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .andWhere('o.created_at >= :start', { start: startOfDay })
      .getRawOne<{ sum: string }>();

    const filteredCountQb = this.orders.createQueryBuilder('o');
    const filteredRevenueQb = this.orders
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total), 0)', 'sum');
    if (statusFilter) {
      filteredCountQb.andWhere('o.status = :status', { status: statusFilter });
      filteredRevenueQb.andWhere('o.status = :status', {
        status: statusFilter,
      });
    } else {
      filteredCountQb.andWhere('o.status != :cancelled', {
        cancelled: OrderStatus.CANCELLED,
      });
      filteredRevenueQb.andWhere('o.status != :cancelled', {
        cancelled: OrderStatus.CANCELLED,
      });
    }
    if (fromDate) {
      filteredCountQb.andWhere('o.created_at >= :from', { from: fromDate });
      filteredRevenueQb.andWhere('o.created_at >= :from', { from: fromDate });
    }
    if (toDate) {
      filteredCountQb.andWhere('o.created_at <= :to', { to: toDate });
      filteredRevenueQb.andWhere('o.created_at <= :to', { to: toDate });
    }
    const filteredOrders = await filteredCountQb.getCount();
    const filteredRevenueRow = await filteredRevenueQb.getRawOne<{
      sum: string;
    }>();

    const pnl = await this.accountingService.profitAndLoss({
      from: fromRaw || undefined,
      to: toRaw || undefined,
    });

    return {
      ordersToday,
      ordersPending,
      ordersTotal,
      revenueTodayPkr: String(revenueTodayRow?.sum ?? '0'),
      revenueTotalPkr: String(revenueTotalRow?.sum ?? '0'),
      from: fromRaw || null,
      to: toRaw || null,
      status: statusFilter,
      filteredOrders,
      filteredRevenuePkr: String(filteredRevenueRow?.sum ?? '0'),
      profitAndLoss: {
        totalRevenue: pnl.totalRevenue,
        totalExpenses: pnl.totalExpenses,
        netIncome: pnl.netIncome,
      },
    };
  }

  async reportsSummary(): Promise<{
    generatedAt: string;
    ordersByStatus: Array<{ status: string; count: number }>;
    revenueByStatusPkr: Array<{ status: string; revenuePkr: string }>;
    topProducts: Array<{
      productName: string;
      quantitySold: number;
      revenuePkr: string;
    }>;
    recentOrders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      total: string;
      customerName: string;
      createdAt: string;
    }>;
    totals: {
      ordersTotal: number;
      revenueTotalPkr: string;
      averageOrderPkr: string;
    };
  }> {
    const statusRows = await this.orders
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('o.status')
      .getRawMany<{ status: string; count: string }>();

    const revenueRows = await this.orders
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COALESCE(SUM(o.total), 0)', 'revenue')
      .groupBy('o.status')
      .getRawMany<{ status: string; revenue: string }>();

    const topProducts = await this.dataSource
      .createQueryBuilder()
      .select('item.product_name', 'productName')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'quantitySold')
      .addSelect('COALESCE(SUM(item.line_total), 0)', 'revenuePkr')
      .from('zevooria_order_items', 'item')
      .innerJoin('zevooria_orders', 'o', 'o.id = item.order_id')
      .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .groupBy('item.product_name')
      .orderBy('SUM(item.quantity)', 'DESC')
      .limit(10)
      .getRawMany<{
        productName: string;
        quantitySold: string;
        revenuePkr: string;
      }>();

    const recent = await this.orders.find({
      order: { createdAt: 'DESC' },
      take: 15,
    });

    const ordersTotal = await this.orders.count();
    const revenueTotalRow = await this.orders
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.total), 0)', 'sum')
      .where('o.status != :cancelled', { cancelled: OrderStatus.CANCELLED })
      .getRawOne<{ sum: string }>();
    const revenueTotal = String(revenueTotalRow?.sum ?? '0');
    const completedCount = await this.orders.count({
      where: {
        status: In([
          OrderStatus.PLACED,
          OrderStatus.PROCESSING,
          OrderStatus.SHIPPED,
          OrderStatus.DELIVERED,
        ]),
      },
    });
    const revenueWhole = Number.parseInt(revenueTotal.split('.')[0] ?? '0', 10);
    const average =
      completedCount > 0 ? Math.trunc(revenueWhole / completedCount) : 0;

    return {
      generatedAt: new Date().toISOString(),
      ordersByStatus: statusRows.map((row) => ({
        status: row.status,
        count: Number(row.count) || 0,
      })),
      revenueByStatusPkr: revenueRows.map((row) => ({
        status: row.status,
        revenuePkr: String(row.revenue ?? '0'),
      })),
      topProducts: topProducts.map((row) => ({
        productName: row.productName,
        quantitySold: Number(row.quantitySold) || 0,
        revenuePkr: String(row.revenuePkr ?? '0'),
      })),
      recentOrders: recent.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        customerName: order.customerName,
        createdAt: order.createdAt.toISOString(),
      })),
      totals: {
        ordersTotal,
        revenueTotalPkr: revenueTotal,
        averageOrderPkr: `${average}.00`,
      },
    };
  }

  async primaryImageKeysForOrders(
    orders: Order[],
  ): Promise<Map<string, string>> {
    const productIds = [
      ...new Set(
        orders
          .flatMap((order) => order.items ?? [])
          .map((item) => item.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const map = new Map<string, string>();
    if (productIds.length === 0) {
      return map;
    }
    const rows = await this.media.find({
      where: {
        productId: In(productIds),
        type: MediaType.IMAGE,
      },
      order: { isPrimary: 'DESC', sortOrder: 'ASC' },
    });
    for (const row of rows) {
      if (!map.has(row.productId)) {
        map.set(row.productId, row.storageKey);
      }
    }
    return map;
  }

  async findByNumberForUser(
    userId: string,
    orderNumber: string,
  ): Promise<Order> {
    const order = await this.orders.findOne({
      where: { orderNumber, userId },
      relations: {
        items: true,
        shippingAddress: true,
        payments: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    return order;
  }

  private createOrderNumber(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = randomBytes(3).toString('hex').toUpperCase();
    return `ZEV-${stamp}-${rand}`;
  }
}

function startOfUtcDay(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T00:00:00.000Z`);
}

function endOfUtcDay(yyyyMmDd: string): Date {
  return new Date(`${yyyyMmDd}T23:59:59.999Z`);
}
