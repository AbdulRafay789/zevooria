import {
  IsInt,
  IsUUID,
  Max,
  Min,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const GUEST_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UpsertCartItemDto {
  @IsUUID('4')
  productId!: string;

  @IsInt()
  @Min(0)
  @Max(20)
  quantity!: number;
}

export class MergeCartDto {
  @IsString()
  @MaxLength(64)
  @Matches(GUEST_KEY_PATTERN, {
    message: 'guestKey must be a UUID',
  })
  guestKey!: string;
}

export class GuestKeyHeaderDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(GUEST_KEY_PATTERN)
  guestKey?: string;
}
