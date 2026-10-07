import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentProviderName,
} from './payment-provider';
import { BankAlfalahProvider } from './providers/bank-alfalah.provider';
import { CodProvider } from './providers/cod.provider';
import { EasyPaisaProvider } from './providers/easypaisa.provider';

@Injectable()
export class PaymentService {
  private readonly providers: Map<PaymentProviderName, PaymentProvider>;

  constructor(
    cod: CodProvider,
    easyPaisa: EasyPaisaProvider,
    bankAlfalah: BankAlfalahProvider,
  ) {
    this.providers = new Map<PaymentProviderName, PaymentProvider>([
      [cod.name, cod],
      [easyPaisa.name, easyPaisa],
      [bankAlfalah.name, bankAlfalah],
    ]);
  }

  async createPayment(
    providerName: PaymentProviderName,
    input: CreatePaymentInput,
  ): Promise<CreatePaymentResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new BadRequestException(
        `Unknown payment provider: ${providerName}`,
      );
    }
    return provider.createPayment(input);
  }
}
