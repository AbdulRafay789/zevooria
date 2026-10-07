import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentProviderName,
} from '../payment-provider';

/** Stub — EasyPaisa is not active in this MVP phase. */
@Injectable()
export class EasyPaisaProvider implements PaymentProvider {
  readonly name = PaymentProviderName.EASYPAISA;

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    void input;
    return Promise.reject(
      new NotImplementedException(
        'EasyPaisa payments are not enabled in this release.',
      ),
    );
  }
}
