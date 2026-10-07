import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../../catalog/entities/product.entity';
import { InventoryMovementType } from '../inventory.enums';
import { Warehouse } from './warehouse.entity';

@Entity({ name: 'zevooria_inventory_movements' })
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid', name: 'warehouse_id' })
  warehouseId!: string;

  @ManyToOne(() => Warehouse, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Index()
  @Column({ type: 'uuid', name: 'product_id' })
  productId!: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  @Column({
    type: 'enum',
    enum: InventoryMovementType,
    enumName: 'inventory_movement_type',
  })
  type!: InventoryMovementType;

  /** Signed delta applied to quantity_on_hand (sale is negative). */
  @Column({ type: 'int', name: 'quantity_delta' })
  quantityDelta!: number;

  @Column({ type: 'int', name: 'quantity_after' })
  quantityAfter!: number;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'reference_type',
    nullable: true,
  })
  referenceType!: string | null;

  @Column({ type: 'uuid', name: 'reference_id', nullable: true })
  referenceId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
