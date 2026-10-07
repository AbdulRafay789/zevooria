import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Product } from '../catalog/entities/product.entity';
import { ProductMedia } from '../catalog/entities/product-media.entity';
import { AccountingModule } from '../accounting/accounting.module';
import { AdminNotificationsModule } from '../admin/admin-notifications.module';
import { AuditModule } from '../audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CustomerEmailService } from '../notifications/customer-email.service';
import { MailModule } from '../notifications/mail.module';
import { PaymentsModule } from '../payments/payments.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { OrderAddress } from './entities/order-address.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Payment } from './entities/payment.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderAddress,
      OrderStatusHistory,
      Payment,
      Product,
      ProductMedia,
    ]),
    AuthModule,
    PaymentsModule,
    InventoryModule,
    AccountingModule,
    AdminNotificationsModule,
    AuditModule,
    PromotionsModule,
    MailModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
