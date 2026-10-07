import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PromoDiscountType } from '../promo-discount.enums';

@Entity({ name: 'zevooria_promo_codes' })
export class PromoCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({
    type: 'enum',
    enum: PromoDiscountType,
    enumName: 'promo_discount_type',
    name: 'discount_type',
  })
  discountType!: PromoDiscountType;

  @Column({ type: 'numeric', precision: 12, scale: 2, name: 'discount_value' })
  discountValue!: string;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'min_subtotal',
    default: 1599,
  })
  minSubtotal!: string;

  @Column({ type: 'int', name: 'max_uses', nullable: true })
  maxUses!: number | null;

  @Column({ type: 'int', name: 'used_count', default: 0 })
  usedCount!: number;

  @Column({ type: 'timestamptz', name: 'starts_at', nullable: true })
  startsAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'ends_at', nullable: true })
  endsAt!: Date | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
