import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ProductStatus } from '../../catalog/catalog.enums';

export class UpdateAdminProductDto {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.0{1,2})?$/, {
    message: 'price must be a whole PKR amount',
  })
  price?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.0{1,2})?$/, {
    message: 'cost must be a whole PKR amount',
  })
  cost?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @Matches(/^\d+(\.0{1,2})?$/, {
    message: 'compareAtPrice must be a whole PKR amount',
  })
  compareAtPrice?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;
}
