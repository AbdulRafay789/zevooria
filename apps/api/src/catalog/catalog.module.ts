import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryModule } from '../inventory/inventory.module';
import { Product } from './entities/product.entity';
import { ProductMedia } from './entities/product-media.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductQrService } from './product-qr.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductMedia]), InventoryModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductQrService],
  exports: [ProductsService, ProductQrService, TypeOrmModule],
})
export class CatalogModule {}
