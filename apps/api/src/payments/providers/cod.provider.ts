import { Injectable } from '@nestjs/common';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentProviderName,
  PaymentStatus,
} from '../payment-provider';

/**
 * Cash on Delivery — payment is not collected online.
 * Status stays PENDING until a later fulfillment/collection phase.
 */
@Injectable()
export class CodProvider implements PaymentProvider {
  readonly name = PaymentProviderName.COD;

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return Promise.resolve({
      provider: PaymentProviderName.COD,
      status: PaymentStatus.PENDING,
      providerReference: `COD-${input.orderId}`,
    });
  }
}
