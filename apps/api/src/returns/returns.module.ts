import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingModule } from '../accounting/accounting.module';
import { AuditModule } from '../audit/audit.module';
import { Product } from '../catalog/entities/product.entity';
import { InventoryModule } from '../inventory/inventory.module';
import { OrderItem } from '../orders/entities/order-item.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { Order } from '../orders/entities/order.entity';
import { ReturnItem } from './entities/return-item.entity';
import { ProductReturn } from './entities/return.entity';
import { ReturnsService } from './returns.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductReturn,
      ReturnItem,
      Order,
      OrderItem,
      OrderStatusHistory,
      Product,
    ]),
    InventoryModule,
    AccountingModule,
    AuditModule,
  ],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
