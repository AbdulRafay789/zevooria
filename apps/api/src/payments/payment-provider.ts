export enum PaymentProviderName {
  COD = 'COD',
  EASYPAISA = 'EASYPAISA',
  BANK_ALFALAH = 'BANK_ALFALAH',
}

export enum PaymentStatus {
  CREATED = 'CREATED',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  REFUNDED = 'REFUNDED',
}

export type CreatePaymentInput = {
  orderId: string;
  amountPkr: number;
  currency: string;
};

export type CreatePaymentResult = {
  provider: PaymentProviderName;
  status: PaymentStatus;
  providerReference: string | null;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
}
