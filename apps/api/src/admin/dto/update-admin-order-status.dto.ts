import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../orders/order.enums';

export class UpdateAdminOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
