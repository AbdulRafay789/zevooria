import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { AdminPermission } from '../admin/entities/admin-permission.entity';
import { AdminRole } from '../admin/entities/admin-role.entity';
import { AdminSession } from '../admin/entities/admin-session.entity';
import { AdminUser } from '../admin/entities/admin-user.entity';
import { AuthToken } from '../auth/entities/auth-token.entity';
import { Session } from '../auth/entities/session.entity';
import { User } from '../auth/entities/user.entity';
import { Product } from '../catalog/entities/product.entity';
import { ProductMedia } from '../catalog/entities/product-media.entity';
import { OrderAddress } from '../orders/entities/order-address.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Order } from '../orders/entities/order.entity';
import { Payment } from '../orders/entities/payment.entity';
import { Review } from '../reviews/entities/review.entity';
import { AdminAuth1758060000000 } from './migrations/1758060000000-AdminAuth';
import { CommerceAuthOrders1758048000000 } from './migrations/1758048000000-CommerceAuthOrders';
import { InitialCatalog1757961600000 } from './migrations/1757961600000-InitialCatalog';
import { ZevooriaTableNamesAndReviews1758051600000 } from './migrations/1758051600000-ZevooriaTableNamesAndReviews';
import { OrderStatusExpansion1758063600000 } from './migrations/1758063600000-OrderStatusExpansion';
import { AdminRbac1758067200000 } from './migrations/1758067200000-AdminRbac';
import { AuthResetAndEmailVerify1758070800000 } from './migrations/1758070800000-AuthResetAndEmailVerify';
import { AuditLogs1758074400000 } from './migrations/1758074400000-AuditLogs';
import { CustomerLifecycleAndStaffRoles1758078000000 } from './migrations/1758078000000-CustomerLifecycleAndStaffRoles';
import { Inventory1758081600000 } from './migrations/1758081600000-Inventory';
import { BootstrapAdminUsers1758085200000 } from './migrations/1758085200000-BootstrapAdminUsers';
import { CustomerAddresses1758088800000 } from './migrations/1758088800000-CustomerAddresses';
import { OrderStatusHistory1758092400000 } from './migrations/1758092400000-OrderStatusHistory';
import { ProductCost1758096000000 } from './migrations/1758096000000-ProductCost';
import { Accounting1758099600000 } from './migrations/1758099600000-Accounting';
import { AdminNotifications1758103200000 } from './migrations/1758103200000-AdminNotifications';
import { ProductArchivedStatus1758106800000 } from './migrations/1758106800000-ProductArchivedStatus';
import { CustomerSessionRefresh1758110400000 } from './migrations/1758110400000-CustomerSessionRefresh';
import { CodPaidOnDelivered1758114000000 } from './migrations/1758114000000-CodPaidOnDelivered';
import { CompareAtSortPromo1758117600000 } from './migrations/1758117600000-CompareAtSortPromo';
import { buildPostgresSslOptions } from './postgres-ssl';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { InventoryStock } from '../inventory/entities/inventory-stock.entity';
import { Warehouse } from '../inventory/entities/warehouse.entity';
import { CustomerAddress } from '../auth/entities/customer-address.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { Account } from '../accounting/entities/account.entity';
import { FiscalPeriod } from '../accounting/entities/fiscal-period.entity';
import { JournalEntry } from '../accounting/entities/journal-entry.entity';
import { JournalLine } from '../accounting/entities/journal-line.entity';
import { AdminNotification } from '../admin/entities/admin-notification.entity';
import { AdminNotificationReceipt } from '../admin/entities/admin-notification-receipt.entity';
import { AdminNotificationPreferences } from '../admin/entities/admin-notification-preferences.entity';
import { AdminPushSubscription } from '../admin/entities/admin-push-subscription.entity';
import { PromoCode } from '../promotions/entities/promo-code.entity';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';
import { ServerCarts1758121200000 } from './migrations/1758121200000-ServerCarts';
import { ProductReturn } from '../returns/entities/return.entity';
import { ReturnItem } from '../returns/entities/return-item.entity';
import { Returns1758124800000 } from './migrations/1758124800000-Returns';
import { NotificationsReadPermission1758128400000 } from './migrations/1758128400000-NotificationsReadPermission';
import { SupportAttachment } from '../support/entities/support-attachment.entity';
import { SupportConversation } from '../support/entities/support-conversation.entity';
import { SupportInboundObject } from '../support/entities/support-inbound-object.entity';
import { SupportMessage } from '../support/entities/support-message.entity';
import { SupportInbox1758132000000 } from './migrations/1758132000000-SupportInbox';
import { SupportAdminPermissions1758135600000 } from './migrations/1758135600000-SupportAdminPermissions';
import { SupportOutboundAwsSesMessageId1758139200000 } from './migrations/1758139200000-SupportOutboundAwsSesMessageId';

// Load repo-root .env when commands run from apps/api
loadEnv({ path: '../../.env' });
loadEnv();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'zevooria',
  password: process.env.DB_PASSWORD ?? 'zevooria',
  database: process.env.DB_NAME ?? 'zevooria',
  ssl: buildPostgresSslOptions(process.env),
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
  migrations: [
    InitialCatalog1757961600000,
    CommerceAuthOrders1758048000000,
    ZevooriaTableNamesAndReviews1758051600000,
    AdminAuth1758060000000,
    OrderStatusExpansion1758063600000,
    AdminRbac1758067200000,
    AuthResetAndEmailVerify1758070800000,
    AuditLogs1758074400000,
    CustomerLifecycleAndStaffRoles1758078000000,
    Inventory1758081600000,
    BootstrapAdminUsers1758085200000,
    CustomerAddresses1758088800000,
    OrderStatusHistory1758092400000,
    ProductCost1758096000000,
    Accounting1758099600000,
    AdminNotifications1758103200000,
    ProductArchivedStatus1758106800000,
    CustomerSessionRefresh1758110400000,
    CodPaidOnDelivered1758114000000,
    CompareAtSortPromo1758117600000,
    ServerCarts1758121200000,
    Returns1758124800000,
    NotificationsReadPermission1758128400000,
    SupportInbox1758132000000,
    SupportAdminPermissions1758135600000,
    SupportOutboundAwsSesMessageId1758139200000,
  ],
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
});
