import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PAKISTAN_CITIES } from '../../common/locations/pakistan-cities';

export class CustomerAddressDto {
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

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateCustomerAddressDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  line1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  line2?: string | null;

  @IsOptional()
  @IsString()
  @IsIn([...PAKISTAN_CITIES], {
    message: 'City must be a supported Pakistan city.',
  })
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9\-\s]+$/)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
