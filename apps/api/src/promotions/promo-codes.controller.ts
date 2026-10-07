import { Body, Controller, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { formatWholePkr } from '../common/money/pkr';
import { PromoCodesService } from './promo-codes.service';

class ValidatePromoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  subtotalPkr!: number;
}

@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly promoCodes: PromoCodesService) {}

  @Post('validate')
  async validate(@Body() body: ValidatePromoDto) {
    const result = await this.promoCodes.validateForSubtotal(
      body.code,
      body.subtotalPkr,
    );
    return {
      code: result.promo.code,
      discountType: result.promo.discountType,
      discountValue: result.promo.discountValue,
      discountAmount: formatWholePkr(result.discountAmount),
      minSubtotal: result.promo.minSubtotal,
    };
  }
}
