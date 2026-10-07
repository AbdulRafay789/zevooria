import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  buildSupportRawMime,
  SUPPORT_FROM_EMAIL_DEFAULT,
  SUPPORT_MAIL_FROM_DEFAULT,
  type SupportRawEmailInput,
} from './support-outbound-mail.util';

const DEFAULT_REGION = 'ap-south-1';

export type SupportOutboundSendInput = {
  toEmail: string;
  subject: string;
  bodyText: string;
  rfcMessageId: string;
  inReplyTo: string | null;
  references: string | null;
};

export type SupportOutboundSendResult = {
  awsSesMessageId: string | null;
};

/**
 * Dedicated SES SendRawEmail path for support replies.
 * Separate from CustomerEmailService / transactional SendEmail.
 */
@Injectable()
export class SupportOutboundService {
  private readonly logger = new Logger(SupportOutboundService.name);
  private readonly client: SESClient;
  private readonly mailFrom: string;
  private readonly fromEmail: string;

  constructor() {
    this.mailFrom =
      process.env.SUPPORT_MAIL_FROM?.trim() || SUPPORT_MAIL_FROM_DEFAULT;
    this.fromEmail =
      process.env.SUPPORT_FROM_EMAIL?.trim() || SUPPORT_FROM_EMAIL_DEFAULT;
    this.client = new SESClient({
      region: process.env.AWS_REGION?.trim() || DEFAULT_REGION,
    });
  }

  getFromHeader(): string {
    return this.mailFrom;
  }

  getFromEmail(): string {
    return this.fromEmail;
  }

  async sendRaw(
    input: SupportOutboundSendInput,
  ): Promise<SupportOutboundSendResult> {
    const mimeInput: SupportRawEmailInput = {
      from: this.mailFrom,
      toEmail: input.toEmail,
      subject: input.subject,
      bodyText: input.bodyText,
      rfcMessageId: input.rfcMessageId,
      inReplyTo: input.inReplyTo,
      references: input.references,
    };
    const raw = buildSupportRawMime(mimeInput);

    try {
      const result = await this.client.send(
        new SendRawEmailCommand({
          Source: this.fromEmail,
          Destinations: [input.toEmail],
          RawMessage: { Data: raw },
        }),
      );
      const awsSesMessageId = result.MessageId?.trim() || null;
      this.logger.log(
        `Support SES SendRawEmail accepted to=${input.toEmail} awsMessageId=${awsSesMessageId ?? 'unknown'} rfcMessageId=${input.rfcMessageId}`,
      );
      return { awsSesMessageId };
    } catch (err: unknown) {
      const name =
        err && typeof err === 'object' && 'name' in err
          ? String(err.name)
          : 'SesError';
      this.logger.error(
        `Support SES SendRawEmail failed to=${input.toEmail} error=${name}`,
      );
      throw new ServiceUnavailableException(
        'Unable to send support reply. Please try again.',
      );
    }
  }
}
