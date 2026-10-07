/**
 * Pure helpers for inbound support email matching and storage keys.
 */

export const SUPPORT_S3_BUCKET_DEFAULT =
  'zevooria-support-inbound-516644465984-ap-south-1-an';
export const SUPPORT_S3_INCOMING_PREFIX = 'incoming/';
export const SUPPORT_S3_ATTACHMENTS_PREFIX = 'support-attachments/';
export const SES_SETUP_NOTIFICATION_KEY = `${SUPPORT_S3_INCOMING_PREFIX}AMAZON_SES_SETUP_NOTIFICATION`;

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Strip angle brackets and whitespace from an RFC Message-ID.
 */
export function normalizeMessageId(
  value: string | null | undefined,
): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/^<?([^<>\s]+)>?$/);
  const id = (match?.[1] ?? trimmed.replace(/[<>]/g, '')).trim().toLowerCase();
  return id || null;
}

export function parseReferencesHeader(
  value: string | string[] | null | undefined,
): string[] {
  if (!value) {
    return [];
  }
  const raw = Array.isArray(value) ? value.join(' ') : value;
  const ids: string[] = [];
  for (const part of raw.split(/\s+/)) {
    const id = normalizeMessageId(part);
    if (id) {
      ids.push(id);
    }
  }
  return [...new Set(ids)];
}

/**
 * Trim, collapse whitespace, strip leading Re:/Fwd: (repeated), lowercase.
 */
export function normalizeSubject(value: string | null | undefined): string {
  let subject = (value ?? '').trim().replace(/\s+/g, ' ');
  // Strip repeated leading Re: / Fwd: / Fw: (case-insensitive).
  let previous = '';
  while (subject !== previous) {
    previous = subject;
    subject = subject
      .replace(/^(re|fwd|fw)\s*:\s*/i, '')
      .trim()
      .replace(/\s+/g, ' ');
  }
  return subject.toLowerCase();
}

export function isSesSetupNotificationKey(s3Key: string): boolean {
  const key = s3Key.trim();
  return (
    key === SES_SETUP_NOTIFICATION_KEY ||
    key.endsWith('/AMAZON_SES_SETUP_NOTIFICATION') ||
    key === 'AMAZON_SES_SETUP_NOTIFICATION'
  );
}

export function extractAddress(
  input:
    | {
        value?: Array<{ address?: string | null; name?: string | null }>;
        text?: string;
      }
    | string
    | null
    | undefined,
): { email: string; name: string | null } {
  if (!input) {
    return { email: '', name: null };
  }
  if (typeof input === 'string') {
    const match = input.match(/^(?:"?([^"]*)"?\s)?<?([^\s<>]+@[^\s<>]+)>?$/);
    if (match) {
      return {
        email: normalizeEmail(match[2]),
        name: match[1]?.trim() || null,
      };
    }
    return { email: normalizeEmail(input), name: null };
  }
  const first = input.value?.[0];
  if (first?.address) {
    return {
      email: normalizeEmail(first.address),
      name: first.name?.trim() || null,
    };
  }
  if (input.text) {
    return extractAddress(input.text);
  }
  return { email: '', name: null };
}

/**
 * Safe filename fragment for S3 keys — no path separators or traversal.
 */
export function safeFileName(fileName: string | null | undefined): string {
  const base =
    (fileName ?? 'attachment').replace(/\\/g, '/').split('/').pop()?.trim() ||
    'attachment';
  const cleaned = base
    .replace(/[^\w.\-()+ ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120);
  return cleaned || 'attachment';
}

export function buildAttachmentStorageKey(input: {
  messageId: string;
  attachmentId: string;
  fileName: string;
}): string {
  const safe = safeFileName(input.fileName);
  // messageId and attachmentId are UUIDs from our DB — safe path segments.
  return `${SUPPORT_S3_ATTACHMENTS_PREFIX}${input.messageId}/${input.attachmentId}-${safe}`;
}
