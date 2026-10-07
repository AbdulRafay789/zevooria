import {
  assertNoHeaderInjection,
  buildReferencesHeader,
  buildSupportRawMime,
  buildSupportReplyBodyText,
  buildSupportReplySubject,
  encodeHeaderPhrase,
  formatMessageIdHeader,
  formatSupportQuotedHistory,
  generateSupportRfcMessageId,
  quotePlainTextLines,
} from './support-outbound-mail.util';

describe('support-outbound-mail.util', () => {
  it('adds a single Re: prefix', () => {
    expect(buildSupportReplySubject('Order issue')).toBe('Re: Order issue');
    expect(buildSupportReplySubject('Re: Order issue')).toBe('Re: Order issue');
    expect(buildSupportReplySubject('Re: Re: Order issue')).toBe(
      'Re: Order issue',
    );
    expect(buildSupportReplySubject('')).toBe('Re: Support request');
    expect(buildSupportReplySubject(null)).toBe('Re: Support request');
  });

  it('generates RFC Message-IDs on zevooria.com', () => {
    const id = generateSupportRfcMessageId();
    expect(id).toMatch(/^[0-9a-f-]{36}@zevooria\.com$/i);
  });

  it('builds References without duplicating the parent id', () => {
    expect(buildReferencesHeader('a@x.com b@x.com', 'b@x.com')).toBe(
      'a@x.com b@x.com',
    );
    expect(buildReferencesHeader('a@x.com', 'c@x.com')).toBe('a@x.com c@x.com');
    expect(buildReferencesHeader(null, 'c@x.com')).toBe('c@x.com');
  });

  it('formats Message-ID headers with angle brackets', () => {
    expect(formatMessageIdHeader('abc@zevooria.com')).toBe(
      '<abc@zevooria.com>',
    );
  });

  it('rejects header injection', () => {
    expect(() => assertNoHeaderInjection('a\r\nb', 'Subject')).toThrow(
      /line breaks/,
    );
  });

  it('encodes non-ASCII subject phrases', () => {
    const encoded = encodeHeaderPhrase('مرحبا');
    expect(encoded.startsWith('=?UTF-8?B?')).toBe(true);
    expect(encodeHeaderPhrase('Plain subject')).toBe('Plain subject');
  });

  it('builds a CRLF MIME message with threading headers', () => {
    const raw = buildSupportRawMime({
      from: 'Zevooria Support <support@zevooria.com>',
      toEmail: 'someone@gmail.com',
      subject: 'Re: Help',
      bodyText: 'Hello\nworld',
      rfcMessageId: 'out@zevooria.com',
      inReplyTo: 'parent@example.com',
      references: 'root@example.com parent@example.com',
    }).toString('utf8');

    expect(raw).toContain('Message-ID: <out@zevooria.com>');
    expect(raw).toContain('In-Reply-To: <parent@example.com>');
    expect(raw).toContain(
      'References: <root@example.com> <parent@example.com>',
    );
    expect(raw).toContain('\r\n\r\n');
    expect(raw).toContain('Content-Transfer-Encoding: base64');
  });

  it('quotes plain-text lines with > prefixes', () => {
    expect(quotePlainTextLines('Hello\nworld')).toBe('> Hello\n> world');
    expect(quotePlainTextLines('')).toBe('> ');
  });

  it('formats quoted history oldest to newest', () => {
    const history = formatSupportQuotedHistory([
      {
        fromEmail: 'a@example.com',
        bodyText: 'First',
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
      },
      {
        fromEmail: 'b@example.com',
        bodyText: 'Second\nline',
        createdAt: new Date('2026-10-01T11:00:00.000Z'),
      },
    ]);
    expect(history).toContain('---------- Previous messages ----------');
    expect(history.indexOf('First')).toBeLessThan(history.indexOf('Second'));
    expect(history).toContain('<a@example.com>');
    expect(history).toContain('> Second');
    expect(history).toContain('> line');
  });

  it('builds reply body with quoted history after admin text', () => {
    const body = buildSupportReplyBodyText({
      replyText: '  Thanks for writing.  ',
      priorMessages: [
        {
          fromEmail: 'someone@gmail.com',
          bodyText: 'I need help',
          createdAt: new Date('2026-10-01T10:00:00.000Z'),
        },
      ],
    });
    expect(body.startsWith('Thanks for writing.')).toBe(true);
    expect(body).toContain('---------- Previous messages ----------');
    expect(body).toContain('> I need help');
  });

  it('returns reply only when there is no prior history', () => {
    expect(
      buildSupportReplyBodyText({
        replyText: 'Hello',
        priorMessages: [],
      }),
    ).toBe('Hello');
  });

  it('uses placeholder when prior body text is empty', () => {
    const history = formatSupportQuotedHistory([
      {
        fromEmail: 'x@y.com',
        bodyText: '   ',
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
      },
    ]);
    expect(history).toContain('> (no text body)');
  });
});
