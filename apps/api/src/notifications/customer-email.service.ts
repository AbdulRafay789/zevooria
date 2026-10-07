import { Injectable } from '@nestjs/common';
import { getWebPublicBaseUrl } from '../common/urls/web-public';
import { orderPlacedEmail, welcomeEmail } from './email-templates';
import { MailService } from './mail.service';

/** Ops BCC for order confirmations only — never applied to welcome/verify/auth mail. */
export const ORDER_CONFIRMATION_BCC = [
  'abdulrafaydeveloper@outlook.com',
  'saad.jabri.iftikhar@gmail.com',
] as const;

export type OrderPlacedEmailInput = {
  to: string;
  customerName?: string | null;
  orderId: string;
  orderNumber: string;
  totalPkr: string;
  currency: string;
  paymentMethod: string;
  items: Array<{ productName: string; quantity: number }>;
};

@Injectable()
export class CustomerEmailService {
  constructor(private readonly mail: MailService) {}

  async sendWelcome(input: { to: string; fullName: string }): Promise<void> {
    const content = welcomeEmail({ fullName: input.fullName });
    await this.mail.send({
      to: input.to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  }

  async sendOrderPlaced(
    input: OrderPlacedEmailInput,
  ): Promise<string | undefined> {
    const base = getWebPublicBaseUrl();
    const confirmationUrl = `${base}/order-confirmation/${encodeURIComponent(input.orderId)}`;
    const itemLines =
      input.items.length > 0
        ? input.items.map((item) => `- ${item.productName} × ${item.quantity}`)
        : ['- (no line items)'];
    const paymentNote =
      input.paymentMethod.toLowerCase() === 'cod'
        ? 'Payment: Cash on Delivery (pay when your order arrives).'
        : `Payment method: ${input.paymentMethod}.`;

    const content = orderPlacedEmail({
      customerName: input.customerName,
      orderNumber: input.orderNumber,
      totalPkr: input.totalPkr,
      currency: input.currency,
      paymentNote,
      itemLines,
      confirmationUrl,
    });

    return this.mail.send({
      to: input.to,
      bcc: [...ORDER_CONFIRMATION_BCC],
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
  }
}
