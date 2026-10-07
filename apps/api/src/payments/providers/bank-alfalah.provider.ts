import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentProviderName,
} from '../payment-provider';

/** Stub — Bank Alfalah is not active in this MVP phase. */
@Injectable()
export class BankAlfalahProvider implements PaymentProvider {
  readonly name = PaymentProviderName.BANK_ALFALAH;

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    void input;
    return Promise.reject(
      new NotImplementedException(
        'Bank Alfalah payments are not enabled in this release.',
      ),
    );
  }
}
