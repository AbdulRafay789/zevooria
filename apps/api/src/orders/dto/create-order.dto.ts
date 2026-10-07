import { Type, Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PAKISTAN_CITIES } from '../../common/locations/pakistan-cities';
import { IsPakistanPhone } from '../../common/validation/is-pakistan-phone';
import { normalizePakistanPhone } from '../../common/validation/phone';
import { PaymentProviderName } from '../../payments/payment-provider';

export class CreateOrderItemDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

export class CreateOrderAddressDto {
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  line2?: string;

  @IsString()
  @IsIn([...PAKISTAN_CITIES], {
    message: 'City must be a supported Pakistan city.',
  })
  city!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9\-\s]+$/)
  postalCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  customerName!: string;

  @IsEmail()
  @MaxLength(320)
  customerEmail!: string;

  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return '';
    }
    return normalizePakistanPhone(value) ?? value.trim();
  })
  @IsString()
  @IsPakistanPhone()
  customerPhone!: string;

  @ValidateNested()
  @Type(() => CreateOrderAddressDto)
  shippingAddress!: CreateOrderAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsEnum(PaymentProviderName)
  paymentMethod!: PaymentProviderName;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  promoCode?: string;
}
