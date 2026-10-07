import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { Session } from '../auth/entities/session.entity';
import { User } from '../auth/entities/user.entity';
import { CatalogModule } from '../catalog/catalog.module';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminInventoryController } from './admin-inventory.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminProductsController } from './admin-products.controller';
import { AdminRbacController } from './admin-rbac.controller';
import { AdminRbacService } from './admin-rbac.service';
import { AdminGuard } from './admin.guard';
import { AdminPermission } from './entities/admin-permission.entity';
import { AdminRole } from './entities/admin-role.entity';
import { AdminSession } from './entities/admin-session.entity';
import { AdminUser } from './entities/admin-user.entity';
import { PermissionsGuard } from './permissions.guard';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountingModule } from '../accounting/accounting.module';
import { AdminAccountingController } from './admin-accounting.controller';
import { AdminNotificationsModule } from './admin-notifications.module';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminPromoCodesController } from './admin-promo-codes.controller';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReturnsController } from './admin-returns.controller';
import { AdminSupportController } from './admin-support.controller';
import { PromotionsModule } from '../promotions/promotions.module';
import { ReturnsModule } from '../returns/returns.module';
import { SupportModule } from '../support/support.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminUser,
      AdminSession,
      AdminRole,
      AdminPermission,
      User,
      Order,
      Session,
    ]),
    OrdersModule,
    CatalogModule,
    AuthModule,
    AuditModule,
    InventoryModule,
    AccountingModule,
    AdminNotificationsModule,
    PromotionsModule,
    ReturnsModule,
    SupportModule,
  ],
  controllers: [
    AdminAuthController,
    AdminDashboardController,
    AdminReportsController,
    AdminOrdersController,
    AdminCustomersController,
    AdminProductsController,
    AdminInventoryController,
    AdminAccountingController,
    AdminNotificationsController,
    AdminAuditController,
    AdminRbacController,
    AdminPromoCodesController,
    AdminReturnsController,
    AdminSupportController,
  ],
  providers: [AdminAuthService, AdminGuard, PermissionsGuard, AdminRbacService],
  exports: [AdminAuthService, AdminGuard, PermissionsGuard, TypeOrmModule],
})
export class AdminModule {}
