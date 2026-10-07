import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { BankAlfalahProvider } from './providers/bank-alfalah.provider';
import { CodProvider } from './providers/cod.provider';
import { EasyPaisaProvider } from './providers/easypaisa.provider';

@Module({
  providers: [
    CodProvider,
    EasyPaisaProvider,
    BankAlfalahProvider,
    PaymentService,
  ],
  exports: [PaymentService],
})
export class PaymentsModule {}
