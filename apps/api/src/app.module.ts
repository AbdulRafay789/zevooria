import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SoftLaunchThrottlerGuard } from './common/security/soft-launch-throttler.guard';
import { RATE_LIMIT_WINDOW_MS } from './common/security/rate-limit';
import { AdminModule } from './admin/admin.module';
import { AdminPermission } from './admin/entities/admin-permission.entity';
import { AdminRole } from './admin/entities/admin-role.entity';
import { AdminSession } from './admin/entities/admin-session.entity';
import { AdminUser } from './admin/entities/admin-user.entity';
import { AuditModule } from './audit/audit.module';
import { AuditLog } from './audit/entities/audit-log.entity';
import { AuthModule } from './auth/auth.module';
import { AuthToken } from './auth/entities/auth-token.entity';
import { CustomerAddress } from './auth/entities/customer-address.entity';
import { Session } from './auth/entities/session.entity';
import { User } from './auth/entities/user.entity';
import { CatalogModule } from './catalog/catalog.module';
import { Product } from './catalog/entities/product.entity';
import { ProductMedia } from './catalog/entities/product-media.entity';
import { AccountingModule } from './accounting/accounting.module';
import { Account } from './accounting/entities/account.entity';
import { FiscalPeriod } from './accounting/entities/fiscal-period.entity';
import { JournalEntry } from './accounting/entities/journal-entry.entity';
import { JournalLine } from './accounting/entities/journal-line.entity';
import { AdminNotification } from './admin/entities/admin-notification.entity';
import { AdminNotificationReceipt } from './admin/entities/admin-notification-receipt.entity';
import { AdminNotificationPreferences } from './admin/entities/admin-notification-preferences.entity';
import { AdminPushSubscription } from './admin/entities/admin-push-subscription.entity';
import { buildPostgresSslOptions } from './database/postgres-ssl';
import { HealthController } from './health/health.controller';
import { InventoryModule } from './inventory/inventory.module';
import { InventoryMovement } from './inventory/entities/inventory-movement.entity';
import { InventoryStock } from './inventory/entities/inventory-stock.entity';
import { Warehouse } from './inventory/entities/warehouse.entity';
import { OrderAddress } from './orders/entities/order-address.entity';
import { OrderItem } from './orders/entities/order-item.entity';
import { Order } from './orders/entities/order.entity';
import { OrderStatusHistory } from './orders/entities/order-status-history.entity';
import { Payment } from './orders/entities/payment.entity';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { Review } from './reviews/entities/review.entity';
import { ReviewsModule } from './reviews/reviews.module';
import { PromotionsModule } from './promotions/promotions.module';
import { PromoCode } from './promotions/entities/promo-code.entity';
import { CartModule } from './cart/cart.module';
import { Cart } from './cart/entities/cart.entity';
import { CartItem } from './cart/entities/cart-item.entity';
import { ReturnsModule } from './returns/returns.module';
import { ProductReturn } from './returns/entities/return.entity';
import { ReturnItem } from './returns/entities/return-item.entity';
import { MailModule } from './notifications/mail.module';
import { SupportAttachment } from './support/entities/support-attachment.entity';
import { SupportConversation } from './support/entities/support-conversation.entity';
import { SupportInboundObject } from './support/entities/support-inbound-object.entity';
import { SupportMessage } from './support/entities/support-message.entity';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: RATE_LIMIT_WINDOW_MS,
        // SoftLaunchThrottlerGuard overrides limit per method/path.
        limit: 100,
      },
    ]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '5432')),
        username: config.get<string>('DB_USER', 'zevooria'),
        password: config.get<string>('DB_PASSWORD', 'zevooria'),
        database: config.get<string>('DB_NAME', 'zevooria'),
        ssl: buildPostgresSslOptions({
          DB_SSL: config.get<string>('DB_SSL'),
          DB_SSL_CA: config.get<string>('DB_SSL_CA'),
        }),
        entities: [
          Product,
          ProductMedia,
          User,
          Session,
          AuthToken,
          AdminUser,
          AdminSession,
          AdminRole,
          AdminPermission,
          AuditLog,
          Order,
          OrderItem,
          OrderAddress,
          Payment,
          Review,
          Warehouse,
          InventoryStock,
          InventoryMovement,
          CustomerAddress,
          OrderStatusHistory,
          Account,
          FiscalPeriod,
          JournalEntry,
          JournalLine,
          AdminNotification,
          AdminNotificationReceipt,
          AdminNotificationPreferences,
          AdminPushSubscription,
          PromoCode,
          Cart,
          CartItem,
          ProductReturn,
          ReturnItem,
          SupportConversation,
          SupportMessage,
          SupportAttachment,
          SupportInboundObject,
        ],
        synchronize: false,
        logging: config.get<string>('TYPEORM_LOGGING') === 'true',
      }),
    }),
    CatalogModule,
    InventoryModule,
    AccountingModule,
    MailModule,
    AuthModule,
    AdminModule,
    AuditModule,
    PaymentsModule,
    OrdersModule,
    ReviewsModule,
    PromotionsModule,
    CartModule,
    ReturnsModule,
    SupportModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SoftLaunchThrottlerGuard,
    },
  ],
})
export class AppModule {}
