import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../catalog/entities/product.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { InventoryStock } from './entities/inventory-stock.entity';
import { Warehouse } from './entities/warehouse.entity';
import { InventoryService } from './inventory.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Warehouse,
      InventoryStock,
      InventoryMovement,
      Product,
    ]),
  ],
  providers: [InventoryService],
  exports: [InventoryService, TypeOrmModule],
})
export class InventoryModule {}
