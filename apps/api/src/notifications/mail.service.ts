import { Injectable } from '@nestjs/common';
import {
  createEmailProvider,
  type EmailMessage,
  type EmailProvider,
} from './email.provider';

/**
 * Shared Nest-injectable mail facade.
 * Next.js / browser never call this — only Nest domain services.
 */
@Injectable()
export class MailService {
  private readonly provider: EmailProvider = createEmailProvider();

  send(message: EmailMessage): Promise<string | undefined> {
    return this.provider.send(message);
  }
}
