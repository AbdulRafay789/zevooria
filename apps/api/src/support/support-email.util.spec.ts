import {
  buildAttachmentStorageKey,
  extractAddress,
  isSesSetupNotificationKey,
  normalizeEmail,
  normalizeMessageId,
  normalizeSubject,
  parseReferencesHeader,
  safeFileName,
  SES_SETUP_NOTIFICATION_KEY,
} from './support-email.util';

describe('support-email.util', () => {
  it('normalizes email to lowercase', () => {
    expect(normalizeEmail('  Ayesha@Example.COM ')).toBe('ayesha@example.com');
  });

  it('normalizes Message-ID with angle brackets', () => {
    expect(normalizeMessageId('<Abc@mail.example>')).toBe('abc@mail.example');
    expect(normalizeMessageId('Abc@mail.example')).toBe('abc@mail.example');
  });

  it('parses References header into normalized ids', () => {
    expect(parseReferencesHeader('<one@ex> <two@ex>')).toEqual([
      'one@ex',
      'two@ex',
    ]);
  });

  it('strips repeated Re:/Fwd: prefixes case-insensitively', () => {
    expect(normalizeSubject('  Re: Fwd: RE:  Hello   World  ')).toBe(
      'hello world',
    );
  });

  it('detects SES setup notification key', () => {
    expect(isSesSetupNotificationKey(SES_SETUP_NOTIFICATION_KEY)).toBe(true);
    expect(isSesSetupNotificationKey('incoming/other')).toBe(false);
  });

  it('extracts display name and email from From', () => {
    expect(
      extractAddress({
        value: [{ address: 'User@Example.com', name: 'Ayesha Khan' }],
      }),
    ).toEqual({ email: 'user@example.com', name: 'Ayesha Khan' });
  });

  it('builds safe attachment storage keys without path traversal', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(
      buildAttachmentStorageKey({
        messageId: '11111111-1111-4111-8111-111111111111',
        attachmentId: '22222222-2222-4222-8222-222222222222',
        fileName: '../evil.pdf',
      }),
    ).toBe(
      'support-attachments/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222-evil.pdf',
    );
  });
});
