import { SesEmailProvider } from './ses-email.provider';
import type { EmailMessage, EmailProvider } from './email.types';

export type { EmailMessage, EmailProvider } from './email.types';

function shouldLogEmailBody(): boolean {
  const flag = process.env.EMAIL_LOG_BODY?.trim().toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') {
    return true;
  }
  if (flag === 'false' || flag === '0' || flag === 'no') {
    return false;
  }
  return process.env.NODE_ENV !== 'production';
}

/**
 * MVP / local provider: writes to stdout.
 * Logs full body (including one-time tokens) when NODE_ENV is not production,
 * or when EMAIL_LOG_BODY=true (local Compose override for Docker production images).
 * Otherwise logs only destination/subject — never token bodies.
 */
export class ConsoleEmailProvider implements EmailProvider {
  send(message: EmailMessage): Promise<string | undefined> {
    console.log(`[email:console] to=${message.to} subject=${message.subject}`);
    if (shouldLogEmailBody()) {
      console.log(message.text);
      if (message.html) {
        console.log(`[email:console] html (${message.html.length} chars)`);
      }
      return Promise.resolve(undefined);
    }

    console.log(`[email:console] body omitted (${message.text.length} chars)`);
    return Promise.resolve(undefined);
  }
}

/**
 * Select email transport:
 * - EMAIL_PROVIDER=ses → Amazon SES API (EC2 IAM role / default credential chain)
 * - EMAIL_PROVIDER=console or unset → ConsoleEmailProvider (local default)
 *
 * SMTP is not used for production selection.
 */
export function createEmailProvider(): EmailProvider {
  const mode = (process.env.EMAIL_PROVIDER ?? 'console').trim().toLowerCase();
  if (mode === 'ses') {
    return new SesEmailProvider();
  }
  return new ConsoleEmailProvider();
}
