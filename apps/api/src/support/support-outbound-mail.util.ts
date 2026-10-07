import { createHash, randomUUID } from 'node:crypto';
import {
  normalizeMessageId,
  parseReferencesHeader,
} from './support-email.util';

export const SUPPORT_MAIL_FROM_DEFAULT =
  'Zevooria Support <support@zevooria.com>';
export const SUPPORT_FROM_EMAIL_DEFAULT = 'support@zevooria.com';

/** Build reply subject with a single Re: prefix. */
export function buildSupportReplySubject(
  subject: string | null | undefined,
): string {
  const trimmed = (subject ?? '').trim();
  const base = (trimmed || 'Support request').replace(/^(re:\s*)+/i, '').trim();
  const safe = (base || 'Support request').slice(0, 990);
  return `Re: ${safe}`;
}

export function generateSupportRfcMessageId(): string {
  return `${randomUUID()}@zevooria.com`;
}

/** Format a normalized id for an RFC header (adds angle brackets). */
export function formatMessageIdHeader(normalizedId: string): string {
  const id = normalizeMessageId(normalizedId);
  if (!id) {
    throw new Error('Invalid message id');
  }
  return `<${id}>`;
}

export function buildReferencesHeader(
  existingReferences: string | null | undefined,
  parentMessageId: string | null | undefined,
): string | null {
  const ids = parseReferencesHeader(existingReferences);
  const parent = normalizeMessageId(parentMessageId);
  if (parent && !ids.includes(parent)) {
    ids.push(parent);
  }
  if (ids.length === 0) {
    return null;
  }
  return ids.join(' ');
}

export function assertNoHeaderInjection(value: string, field: string): void {
  if (/[\r\n]/.test(value)) {
    throw new Error(`Invalid ${field}: contains line breaks`);
  }
}

/** RFC 2047 Base64 encoded-word when non-ASCII; otherwise pass through. */
export function encodeHeaderPhrase(value: string): string {
  assertNoHeaderInjection(value, 'header');

  if (/^[\x20-\x7E]*$/.test(value)) {
    return value;
  }
  const b64 = Buffer.from(value, 'utf8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

export type SupportRawEmailInput = {
  from: string;
  toEmail: string;
  subject: string;
  bodyText: string;
  rfcMessageId: string;
  inReplyTo: string | null;
  references: string | null;
};

/** Max prior messages included in outbound quoted history. */
export const SUPPORT_REPLY_HISTORY_MAX_MESSAGES = 20;
/** Soft cap on quoted history size (UTF-8 bytes). */
export const SUPPORT_REPLY_HISTORY_MAX_BYTES = 50 * 1024;

export type SupportQuotedHistoryMessage = {
  fromEmail: string;
  bodyText: string | null | undefined;
  createdAt: Date | string;
};

/** Prefix each line with `>` for classic plain-text quotation. */
export function quotePlainTextLines(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.length > 0 ? normalized.split('\n') : [''];
  return lines.map((line) => `> ${line}`).join('\n');
}

function formatHistoryTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unknown time';
  }
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');
}

function historyBodyText(bodyText: string | null | undefined): string {
  const trimmed = (bodyText ?? '').trim();
  return trimmed || '(no text body)';
}

/**
 * Format prior conversation messages as quoted plain-text history
 * (oldest → newest). Caps message count and total byte size.
 */
export function formatSupportQuotedHistory(
  messages: SupportQuotedHistoryMessage[],
): string {
  if (messages.length === 0) {
    return '';
  }

  const selected = messages.slice(-SUPPORT_REPLY_HISTORY_MAX_MESSAGES);
  // Prefer newest messages when applying the byte budget, then emit oldest→newest.
  const newestFirst: string[] = [];
  let totalBytes = 0;

  for (let i = selected.length - 1; i >= 0; i -= 1) {
    const message = selected[i];
    const email = (message.fromEmail ?? '').trim() || 'unknown';
    const header = `On ${formatHistoryTimestamp(message.createdAt)}, <${email}> wrote:`;
    const quoted = quotePlainTextLines(historyBodyText(message.bodyText));
    const block = `${header}\n${quoted}`;
    const nextBytes =
      totalBytes +
      Buffer.byteLength(block, 'utf8') +
      (newestFirst.length > 0 ? 2 : 0);
    if (newestFirst.length > 0 && nextBytes > SUPPORT_REPLY_HISTORY_MAX_BYTES) {
      break;
    }
    newestFirst.push(block);
    totalBytes = nextBytes;
  }

  if (newestFirst.length === 0) {
    return '';
  }

  const blocks = newestFirst.reverse();
  return `---------- Previous messages ----------\n\n${blocks.join('\n\n')}`;
}

/**
 * Build the plain-text body sent via SES: admin reply + optional quoted history.
 * Persist only `replyText` in the database — not the quoted section.
 */
export function buildSupportReplyBodyText(input: {
  replyText: string;
  priorMessages: SupportQuotedHistoryMessage[];
}): string {
  const reply = input.replyText.trim();
  const history = formatSupportQuotedHistory(input.priorMessages);
  if (!history) {
    return reply;
  }
  return `${reply}\n\n${history}`;
}

/**
 * Build a CRLF plain-text MIME message for SES SendRawEmail.
 * Values must already be validated (no CR/LF in address headers).
 */
export function buildSupportRawMime(input: SupportRawEmailInput): Buffer {
  assertNoHeaderInjection(input.from, 'From');
  assertNoHeaderInjection(input.toEmail, 'To');
  assertNoHeaderInjection(input.subject, 'Subject');
  assertNoHeaderInjection(input.rfcMessageId, 'Message-ID');

  const lines: string[] = [
    `From: ${input.from}`,
    `To: ${input.toEmail}`,
    `Subject: ${encodeHeaderPhrase(input.subject)}`,
    `Message-ID: ${formatMessageIdHeader(input.rfcMessageId)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];

  if (input.inReplyTo) {
    const parent = normalizeMessageId(input.inReplyTo);
    if (parent) {
      assertNoHeaderInjection(parent, 'In-Reply-To');
      lines.push(`In-Reply-To: ${formatMessageIdHeader(parent)}`);
    }
  }

  if (input.references) {
    const refs = parseReferencesHeader(input.references)
      .map((id) => formatMessageIdHeader(id))
      .join(' ');
    if (refs) {
      assertNoHeaderInjection(refs, 'References');
      lines.push(`References: ${refs}`);
    }
  }

  const bodyB64 = Buffer.from(input.bodyText, 'utf8')
    .toString('base64')
    .replace(/(.{76})/g, '$1\r\n')
    .trim();

  const raw = `${lines.join('\r\n')}\r\n\r\n${bodyB64}\r\n`;
  return Buffer.from(raw, 'utf8');
}

/** Stable content fingerprint for logging without storing bodies. */
export function supportBodyFingerprint(bodyText: string): string {
  return createHash('sha256').update(bodyText).digest('hex').slice(0, 12);
}
