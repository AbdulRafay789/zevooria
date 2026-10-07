import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { SendEmailCommand } from '@aws-sdk/client-ses';
import { SesEmailProvider } from './ses-email.provider';

describe('SesEmailProvider', () => {
  it('returns SES MessageId and logs recipient + messageId without the body', async () => {
    const send = jest.fn().mockResolvedValue({ MessageId: 'mid-1' });
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const consoleLog = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const provider = new SesEmailProvider({
      mailFrom: 'Zevooria <no-reply@zevooria.com>',
      client: { send } as never,
    });

    await expect(
      provider.send({
        to: 'buyer@example.com',
        subject: 'Hello',
        text: 'secret-token-xyz',
        html: '<p>secret-token-xyz</p>',
      }),
    ).resolves.toBe('mid-1');

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect(command.input).toMatchObject({
      Source: 'Zevooria <no-reply@zevooria.com>',
      Destination: { ToAddresses: ['buyer@example.com'] },
      Message: {
        Subject: { Data: 'Hello', Charset: 'UTF-8' },
        Body: {
          Text: { Data: 'secret-token-xyz', Charset: 'UTF-8' },
          Html: { Data: '<p>secret-token-xyz</p>', Charset: 'UTF-8' },
        },
      },
    });
    expect(command.input.Destination.BccAddresses).toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('to=buyer@example.com'),
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('messageId=mid-1'),
    );
    expect(log.mock.calls.flat().join(' ')).not.toContain('secret-token-xyz');
    log.mockRestore();
    consoleLog.mockRestore();
  });

  it('maps bcc to Destination.BccAddresses without putting them in To', async () => {
    const send = jest.fn().mockResolvedValue({ MessageId: 'mid-bcc' });
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const provider = new SesEmailProvider({
      mailFrom: 'Zevooria <no-reply@zevooria.com>',
      client: { send } as never,
    });

    await provider.send({
      to: 'buyer@example.com',
      bcc: ['abdulrafaydeveloper@outlook.com', 'saad.jabri.iftikhar@gmail.com'],
      subject: 'Order',
      text: 'thanks',
    });

    const command = send.mock.calls[0][0];
    expect(command.input.Destination).toEqual({
      ToAddresses: ['buyer@example.com'],
      BccAddresses: [
        'abdulrafaydeveloper@outlook.com',
        'saad.jabri.iftikhar@gmail.com',
      ],
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        'bcc=abdulrafaydeveloper@outlook.com,saad.jabri.iftikhar@gmail.com',
      ),
    );
    log.mockRestore();
  });

  it('maps SES failures to ServiceUnavailableException including SES error name', async () => {
    const send = jest.fn().mockRejectedValue({
      name: 'MessageRejected',
      message: 'internal aws detail',
    });
    const provider = new SesEmailProvider({
      client: { send } as never,
    });

    let caught: unknown;
    try {
      await provider.send({
        to: 'buyer@example.com',
        subject: 'Hello',
        text: 'body',
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ServiceUnavailableException);
    expect((caught as ServiceUnavailableException).message).toContain(
      'MessageRejected',
    );
    expect((caught as ServiceUnavailableException).message).not.toContain(
      'internal aws detail',
    );
  });
});
