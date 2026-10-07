import { MailService } from './mail.service';
import {
  CustomerEmailService,
  ORDER_CONFIRMATION_BCC,
} from './customer-email.service';

describe('CustomerEmailService', () => {
  const send = jest.fn().mockResolvedValue(undefined);
  const mail = { send } as unknown as MailService;

  beforeEach(() => {
    send.mockClear();
    process.env.WEB_PUBLIC_URL = 'https://zevooria.com';
  });

  it('sends branded welcome email on signup without BCC', async () => {
    const service = new CustomerEmailService(mail);
    await service.sendWelcome({
      to: 'new@example.com',
      fullName: 'Amina',
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        subject: 'Welcome to Zevooria',
        text: expect.stringContaining('Hello Amina'),
        html: expect.stringContaining('Welcome to Zevooria'),
      }),
    );
    expect(send.mock.calls[0][0].bcc).toBeUndefined();
    expect(send.mock.calls[0][0].html).toContain('/brand/logo.png');
  });

  it('sends order-placed email to the customer with ops BCC', async () => {
    const service = new CustomerEmailService(mail);
    await service.sendOrderPlaced({
      to: 'buyer@example.com',
      customerName: 'Buyer',
      orderId: 'ord-1',
      orderNumber: 'ZEV-100',
      totalPkr: '2500',
      currency: 'PKR',
      paymentMethod: 'cod',
      items: [{ productName: 'Noir', quantity: 2 }],
    });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'buyer@example.com',
        bcc: [...ORDER_CONFIRMATION_BCC],
        subject: 'Zevooria order ZEV-100 received',
        text: expect.stringContaining(
          'https://zevooria.com/order-confirmation/ord-1',
        ),
        html: expect.stringContaining('Order received'),
      }),
    );
    expect(send.mock.calls[0][0].bcc).toEqual([
      'abdulrafaydeveloper@outlook.com',
      'saad.jabri.iftikhar@gmail.com',
    ]);
    expect(send.mock.calls[0][0].to).toBe('buyer@example.com');
    expect(send.mock.calls[0][0].text).toContain('Noir × 2');
    expect(send.mock.calls[0][0].text).toContain('Cash on Delivery');
  });
});
