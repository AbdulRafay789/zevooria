import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ArrayMinSize,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ProductStatus } from '../../catalog/catalog.enums';

export class CreateAdminProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case',
  })
  slug?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  description!: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsString()
  @Matches(/^\d+(\.0{1,2})?$/, {
    message: 'price must be a whole PKR amount',
  })
  price!: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @Matches(/^\d+(\.0{1,2})?$/, {
    message: 'compareAtPrice must be a whole PKR amount',
  })
  compareAtPrice?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.0{1,2})?$/, {
    message: 'cost must be a whole PKR amount',
  })
  cost?: string;
}

export class ReorderAdminProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  productIds!: string[];
}
