import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateInventoryStockDto {
  @IsInt()
  @Min(0)
  quantityOnHand!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
