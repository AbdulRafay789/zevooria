import {
  SESClient,
  SendEmailCommand,
  type SendEmailCommandInput,
} from '@aws-sdk/client-ses';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { EmailMessage, EmailProvider } from './email.types';

const DEFAULT_REGION = 'ap-south-1';
const DEFAULT_MAIL_FROM = 'Zevooria <no-reply@zevooria.com>';

export type SesEmailProviderOptions = {
  region?: string;
  mailFrom?: string;
  /** Injected in tests; production uses default credential provider chain. */
  client?: SESClient;
};

/**
 * Amazon SES API provider. Credentials come from the AWS SDK default chain
 * (EC2 instance role in production). Never accepts or logs access keys.
 */
export class SesEmailProvider implements EmailProvider {
  private readonly logger = new Logger(SesEmailProvider.name);
  private readonly client: SESClient;
  private readonly mailFrom: string;

  constructor(options: SesEmailProviderOptions = {}) {
    this.mailFrom =
      options.mailFrom?.trim() ||
      process.env.MAIL_FROM?.trim() ||
      DEFAULT_MAIL_FROM;
    this.client =
      options.client ??
      new SESClient({
        region:
          options.region?.trim() ||
          process.env.AWS_REGION?.trim() ||
          DEFAULT_REGION,
      });
  }

  async send(message: EmailMessage): Promise<string | undefined> {
    const bcc = (message.bcc ?? [])
      .map((address) => address.trim())
      .filter(Boolean);

    const input: SendEmailCommandInput = {
      Source: this.mailFrom,
      Destination: {
        ToAddresses: [message.to],
        ...(bcc.length > 0 ? { BccAddresses: bcc } : {}),
      },
      Message: {
        Subject: { Data: message.subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: message.text, Charset: 'UTF-8' },
          ...(message.html
            ? { Html: { Data: message.html, Charset: 'UTF-8' } }
            : {}),
        },
      },
    };

    try {
      const result = await this.client.send(new SendEmailCommand(input));
      const messageId = result.MessageId?.trim() || undefined;
      // Diagnostic only — never log subject/body/tokens/credentials.
      const bccNote = bcc.length > 0 ? ` bcc=${bcc.join(',')}` : '';
      this.logger.log(
        `SES accepted email to=${message.to}${bccNote} messageId=${messageId ?? 'unknown'}`,
      );
      return messageId;
    } catch (err) {
      const name =
        err && typeof err === 'object' && 'name' in err
          ? String((err as { name: unknown }).name)
          : 'SesError';
      // Never log message bodies, tokens, or credential material.
      throw new ServiceUnavailableException(
        `Email delivery failed (${name}). Try again later.`,
      );
    }
  }
}
