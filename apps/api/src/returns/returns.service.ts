import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AccountingService } from '../accounting/accounting.service';
import { AuditService } from '../audit/audit.service';
import { Product } from '../catalog/entities/product.entity';
import { formatWholePkr, parseWholePkr } from '../common/money/pkr';
import { InventoryService } from '../inventory/inventory.service';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/order.enums';
import { CreateReturnDto } from './dto/create-return.dto';
import { ReturnItem } from './entities/return-item.entity';
import { ProductReturn } from './entities/return.entity';
import { RETURN_WINDOW_DAYS, ReturnStatus } from './return.enums';

@Injectable()
export class ReturnsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly inventory: InventoryService,
    private readonly accounting: AccountingService,
    private readonly audit: AuditService,
    @InjectRepository(ProductReturn)
    private readonly returns: Repository<ProductReturn>,
    @InjectRepository(Order)
    private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private readonly statusHistory: Repository<OrderStatusHistory>,
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  async list(): Promise<ProductReturn[]> {
    return this.returns.find({
      relations: { items: true, order: true },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  async getById(id: string): Promise<ProductReturn> {
    const row = await this.returns.findOne({
      where: { id },
      relations: { items: true, order: true },
    });
    if (!row) {
      throw new NotFoundException('Return not found.');
    }
    return row;
  }

  async create(dto: CreateReturnDto, adminId: string): Promise<ProductReturn> {
    const order = await this.orders.findOne({
      where: { id: dto.orderId },
      relations: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Order not found.');
    }
    if (order.status !== OrderStatus.DELIVERED) {
      throw new BadRequestException(
        'Returns can only be created for delivered orders.',
      );
    }

    const deliveredAt = await this.resolveDeliveredAt(order.id);
    if (!deliveredAt) {
      throw new BadRequestException(
        'Order has no delivery timestamp; cannot validate return window.',
      );
    }
    const windowEnd = new Date(deliveredAt);
    windowEnd.setDate(windowEnd.getDate() + RETURN_WINDOW_DAYS);
    if (Date.now() > windowEnd.getTime()) {
      throw new BadRequestException(
        `Return window is ${RETURN_WINDOW_DAYS} days from delivery.`,
      );
    }

    const orderItemIds = dto.items.map((item) => item.orderItemId);
    const uniqueIds = new Set(orderItemIds);
    if (uniqueIds.size !== orderItemIds.length) {
      throw new BadRequestException('Duplicate order items in return.');
    }

    const orderItems = order.items ?? [];
    const byId = new Map(orderItems.map((item) => [item.id, item]));

    const priorReturns = await this.returns.find({
      where: {
        orderId: order.id,
        status: In([
          ReturnStatus.PENDING_INSPECT,
          ReturnStatus.INSPECTED,
          ReturnStatus.REFUNDED,
        ]),
      },
      relations: { items: true },
    });
    const alreadyReturnedQty = new Map<string, number>();
    for (const prior of priorReturns) {
      for (const item of prior.items ?? []) {
        alreadyReturnedQty.set(
          item.orderItemId,
          (alreadyReturnedQty.get(item.orderItemId) ?? 0) + item.quantity,
        );
      }
    }

    const subtotal = parseWholePkr(order.subtotal, 'subtotal');
    const discount = parseWholePkr(order.discountAmount ?? '0', 'discount');
    const merchandiseNet = Math.max(0, subtotal - discount);
    const alreadyRefunded = priorReturns.reduce(
      (sum, row) => sum + parseWholePkr(row.refundAmount, 'refund'),
      0,
    );
    let remainingRefundable = Math.max(0, merchandiseNet - alreadyRefunded);

    const built: Array<{
      orderItem: OrderItem;
      quantity: number;
      lineRefund: number;
    }> = [];

    for (const line of dto.items) {
      const orderItem = byId.get(line.orderItemId);
      if (!orderItem) {
        throw new BadRequestException(
          `Order item ${line.orderItemId} does not belong to this order.`,
        );
      }
      const returned = alreadyReturnedQty.get(orderItem.id) ?? 0;
      const available = orderItem.quantity - returned;
      if (line.quantity > available) {
        throw new BadRequestException(
          `Cannot return ${line.quantity} of ${orderItem.productName}; ${available} remaining.`,
        );
      }
      const unit = parseWholePkr(orderItem.unitPrice, 'unitPrice');
      const gross = unit * line.quantity;
      let lineRefund = gross;
      if (subtotal > 0 && discount > 0) {
        lineRefund = Math.floor((gross * merchandiseNet) / subtotal);
      }
      lineRefund = Math.min(lineRefund, remainingRefundable);
      remainingRefundable -= lineRefund;
      built.push({ orderItem, quantity: line.quantity, lineRefund });
    }

    const refundTotal = built.reduce((sum, row) => sum + row.lineRefund, 0);
    if (refundTotal < 1) {
      throw new BadRequestException(
        'Return refund amount must be at least PKR 1.',
      );
    }

    const created = await this.dataSource.transaction(async (manager) => {
      const ret = await manager.save(
        manager.create(ProductReturn, {
          orderId: order.id,
          status: ReturnStatus.PENDING_INSPECT,
          reason: dto.reason?.trim() || null,
          refundAmount: formatWholePkr(refundTotal),
          createdByAdminId: adminId,
        }),
      );
      const items = built.map((row) =>
        manager.create(ReturnItem, {
          returnId: ret.id,
          orderItemId: row.orderItem.id,
          productId: row.orderItem.productId,
          productName: row.orderItem.productName,
          quantity: row.quantity,
          unitPrice: row.orderItem.unitPrice,
          lineRefund: formatWholePkr(row.lineRefund),
        }),
      );
      await manager.save(items);
      return manager.findOne(ProductReturn, {
        where: { id: ret.id },
        relations: { items: true, order: true },
      });
    });

    if (!created) {
      throw new BadRequestException('Return could not be loaded after create.');
    }

    await this.audit.record({
      actorType: 'admin',
      actorId: adminId,
      action: 'return.create',
      resourceType: 'return',
      resourceId: created.id,
      metadata: { orderId: order.id, refundAmount: created.refundAmount },
    });

    return created;
  }

  async inspectAndRestock(
    returnId: string,
    adminId: string,
  ): Promise<ProductReturn> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(ProductReturn, {
        where: { id: returnId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException('Return not found.');
      }
      if (locked.status !== ReturnStatus.PENDING_INSPECT) {
        throw new BadRequestException(
          `Return must be pending_inspect (currently ${locked.status}).`,
        );
      }
      const ret = await manager.findOne(ProductReturn, {
        where: { id: returnId },
        relations: { items: true, order: true },
      });
      if (!ret || !ret.order) {
        throw new NotFoundException('Return not found.');
      }

      const stockLines = (ret.items ?? [])
        .filter((item) => Boolean(item.productId))
        .map((item) => ({
          productId: item.productId as string,
          quantity: item.quantity,
          productName: item.productName,
        }));

      await this.inventory.restockForReturn(manager, stockLines, ret.id);

      const productIds = stockLines.map((line) => line.productId);
      const products =
        productIds.length === 0
          ? []
          : await manager.find(Product, { where: { id: In(productIds) } });
      const costById = new Map(
        products.map((product) => [
          product.id,
          parseWholePkr(product.cost ?? '0', 'cost'),
        ]),
      );
      let cogs = 0;
      for (const line of stockLines) {
        cogs += (costById.get(line.productId) ?? 0) * line.quantity;
      }

      const refundAmount = parseWholePkr(ret.refundAmount, 'refund');
      await this.accounting.postReturnInspect({
        returnId: ret.id,
        orderNumber: ret.order.orderNumber,
        refundAmountPkr: refundAmount,
        cogsPkr: cogs,
        manager,
      });

      const now = new Date();
      ret.status = ReturnStatus.INSPECTED;
      ret.inspectedAt = now;
      ret.restockedAt = now;
      await manager.save(ret);
      return manager.findOne(ProductReturn, {
        where: { id: ret.id },
        relations: { items: true, order: true },
      });
    });

    if (!updated) {
      throw new NotFoundException('Return not found.');
    }

    await this.audit.record({
      actorType: 'admin',
      actorId: adminId,
      action: 'return.inspect',
      resourceType: 'return',
      resourceId: updated.id,
      metadata: { refundAmount: updated.refundAmount },
    });

    return updated;
  }

  async markRefundPaid(
    returnId: string,
    adminId: string,
  ): Promise<ProductReturn> {
    const updated = await this.dataSource.transaction(async (manager) => {
      const locked = await manager.findOne(ProductReturn, {
        where: { id: returnId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException('Return not found.');
      }
      if (locked.status !== ReturnStatus.INSPECTED) {
        throw new BadRequestException(
          `Return must be inspected before refund payment (currently ${locked.status}).`,
        );
      }
      const ret = await manager.findOne(ProductReturn, {
        where: { id: returnId },
        relations: { items: true, order: true },
      });
      if (!ret || !ret.order) {
        throw new NotFoundException('Return not found.');
      }

      const refundAmount = parseWholePkr(ret.refundAmount, 'refund');
      await this.accounting.postReturnRefundPaid({
        returnId: ret.id,
        orderNumber: ret.order.orderNumber,
        refundAmountPkr: refundAmount,
        manager,
      });

      ret.status = ReturnStatus.REFUNDED;
      ret.refundedAt = new Date();
      await manager.save(ret);
      return manager.findOne(ProductReturn, {
        where: { id: ret.id },
        relations: { items: true, order: true },
      });
    });

    if (!updated) {
      throw new NotFoundException('Return not found.');
    }

    await this.audit.record({
      actorType: 'admin',
      actorId: adminId,
      action: 'return.refund_paid',
      resourceType: 'return',
      resourceId: updated.id,
      metadata: { refundAmount: updated.refundAmount },
    });

    return updated;
  }

  private async resolveDeliveredAt(orderId: string): Promise<Date | null> {
    const row = await this.statusHistory.findOne({
      where: {
        orderId,
        toStatus: OrderStatus.DELIVERED,
      },
      order: { createdAt: 'DESC' },
    });
    return row?.createdAt ?? null;
  }
}
