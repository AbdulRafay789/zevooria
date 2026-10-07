import { getWebPublicBaseUrl } from '../common/urls/web-public';

export type BrandedEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function logoUrl(): string {
  return `${getWebPublicBaseUrl()}/brand/logo.png`;
}

function storefrontUrl(path = '/'): string {
  const base = getWebPublicBaseUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

function wrapHtml(options: {
  preheader: string;
  greeting: string;
  title: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaHref?: string;
  footerNote?: string;
}): string {
  const logo = logoUrl();
  const paragraphs = options.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a433c;">${p}</p>`,
    )
    .join('');
  const cta =
    options.ctaLabel && options.ctaHref
      ? `<p style="margin:28px 0 8px;">
          <a href="${escapeHtml(options.ctaHref)}"
             style="display:inline-block;padding:12px 22px;background:#1c1917;color:#f7f3ec;text-decoration:none;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;">
            ${escapeHtml(options.ctaLabel)}
          </a>
        </p>`
      : '';
  const footer = options.footerNote
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#8a8178;">${options.footerNote}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f0ea;font-family:Georgia,'Times New Roman',serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f0ea;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf9;border:1px solid #e6dfd4;">
          <tr>
            <td style="padding:28px 28px 12px;text-align:center;border-bottom:1px solid #efe8de;">
              <img src="${escapeHtml(logo)}" alt="Zevooria" width="140" style="display:inline-block;max-width:140px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#c9a96e;">Zevooria</p>
              <h1 style="margin:0 0 18px;font-size:26px;font-weight:400;letter-spacing:0.04em;color:#1c1917;">${escapeHtml(options.title)}</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a433c;">${escapeHtml(options.greeting)}</p>
              ${paragraphs}
              ${cta}
              ${footer}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#1c1917;color:#d6cfc6;font-size:12px;line-height:1.5;text-align:center;">
              Fragrance crafted with care · <a href="${escapeHtml(storefrontUrl('/'))}" style="color:#c9a96e;text-decoration:none;">zevooria.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function welcomeEmail(input: { fullName: string }): BrandedEmailContent {
  const name = input.fullName.trim() || 'there';
  const collection = storefrontUrl('/collection');
  const subject = 'Welcome to Zevooria';
  const text = [
    `Hello ${name},`,
    '',
    'Welcome to Zevooria — we are glad you are here.',
    '',
    'Explore our collection of carefully crafted fragrances, place Cash on Delivery orders, and manage your account anytime.',
    '',
    `Shop now: ${collection}`,
    '',
    'With warm regards,',
    'The Zevooria team',
    '',
  ].join('\n');

  return {
    subject,
    text,
    html: wrapHtml({
      preheader: 'Welcome to Zevooria — explore our fragrance collection.',
      greeting: `Hello ${name},`,
      title: 'Welcome to Zevooria',
      paragraphs: [
        'We are glad you are here. Discover carefully crafted fragrances, enjoy Cash on Delivery at checkout, and manage your orders from your account.',
        'A verification email is on its way so we can keep your account secure.',
      ].map(escapeHtml),
      ctaLabel: 'Explore the collection',
      ctaHref: collection,
      footerNote: escapeHtml(
        'If you did not create this account, you can ignore this message.',
      ),
    }),
  };
}

export function verifyEmailMessage(input: {
  fullName?: string | null;
  link: string;
  token: string;
}): BrandedEmailContent {
  const name = input.fullName?.trim() || 'there';
  const subject = 'Verify your Zevooria email';
  const text = [
    `Hello ${name},`,
    '',
    'Please verify your Zevooria email using this link (expires in 24 hours):',
    '',
    input.link,
    '',
    'If the link does not work, paste this token on the verify page:',
    input.token,
    '',
    'With warm regards,',
    'The Zevooria team',
    '',
  ].join('\n');

  return {
    subject,
    text,
    html: wrapHtml({
      preheader: 'Confirm your email to secure your Zevooria account.',
      greeting: `Hello ${name},`,
      title: 'Verify your email',
      paragraphs: [
        'Confirm your email address so we can keep your account secure and send order updates.',
        'This link expires in 24 hours.',
        `If the button does not work, paste this token on the verify page:<br/><span style="font-family:Consolas,monospace;font-size:13px;color:#1c1917;">${escapeHtml(input.token)}</span>`,
      ],
      ctaLabel: 'Verify email',
      ctaHref: input.link,
    }),
  };
}

export function passwordResetEmail(input: {
  fullName?: string | null;
  link: string;
  token: string;
}): BrandedEmailContent {
  const name = input.fullName?.trim() || 'there';
  const subject = 'Zevooria password reset';
  const text = [
    `Hello ${name},`,
    '',
    'Reset your Zevooria password using this link (expires in 1 hour):',
    '',
    input.link,
    '',
    'If the link does not work, paste this token on the reset page:',
    input.token,
    '',
    'If you did not request a reset, you can ignore this email.',
    '',
    'With warm regards,',
    'The Zevooria team',
    '',
  ].join('\n');

  return {
    subject,
    text,
    html: wrapHtml({
      preheader: 'Reset your Zevooria password.',
      greeting: `Hello ${name},`,
      title: 'Reset your password',
      paragraphs: [
        'We received a request to reset your password. This link expires in 1 hour.',
        `If the button does not work, paste this token on the reset page:<br/><span style="font-family:Consolas,monospace;font-size:13px;color:#1c1917;">${escapeHtml(input.token)}</span>`,
        'If you did not request this, you can safely ignore this email.',
      ],
      ctaLabel: 'Reset password',
      ctaHref: input.link,
    }),
  };
}

export function adminPasswordResetEmail(input: {
  token: string;
}): BrandedEmailContent {
  const subject = 'Zevooria admin password reset';
  const text = [
    'Hello,',
    '',
    'Use this token to reset your admin password (expires in 1 hour):',
    '',
    input.token,
    '',
    'If you did not request this, contact Zevooria ops immediately.',
    '',
  ].join('\n');

  return {
    subject,
    text,
    html: wrapHtml({
      preheader: 'Admin password reset token for Zevooria.',
      greeting: 'Hello,',
      title: 'Admin password reset',
      paragraphs: [
        'Use the token below to reset your admin password. It expires in 1 hour.',
        `<span style="font-family:Consolas,monospace;font-size:13px;color:#1c1917;">${escapeHtml(input.token)}</span>`,
        'If you did not request this, contact Zevooria ops immediately.',
      ],
    }),
  };
}

export function orderPlacedEmail(input: {
  customerName?: string | null;
  orderNumber: string;
  totalPkr: string;
  currency: string;
  paymentNote: string;
  itemLines: string[];
  confirmationUrl: string;
}): BrandedEmailContent {
  const name = input.customerName?.trim() || 'there';
  const subject = `Zevooria order ${input.orderNumber} received`;
  const text = [
    `Hello ${name},`,
    '',
    `Thanks for your order ${input.orderNumber}.`,
    '',
    `Total: ${input.totalPkr} ${input.currency}`,
    input.paymentNote,
    '',
    'Items:',
    ...input.itemLines,
    '',
    `View confirmation: ${input.confirmationUrl}`,
    '',
    'With warm regards,',
    'The Zevooria team',
    '',
  ].join('\n');

  const itemsHtml = input.itemLines
    .map(
      (line) =>
        `<li style="margin:0 0 6px;">${escapeHtml(line.replace(/^- /, ''))}</li>`,
    )
    .join('');

  return {
    subject,
    text,
    html: wrapHtml({
      preheader: `Order ${input.orderNumber} received — thank you.`,
      greeting: `Hello ${name},`,
      title: 'Order received',
      paragraphs: [
        `Thank you for your order <strong>${escapeHtml(input.orderNumber)}</strong>.`,
        `Total: <strong>${escapeHtml(input.totalPkr)} ${escapeHtml(input.currency)}</strong>`,
        escapeHtml(input.paymentNote),
        `Items:<ul style="margin:8px 0 0;padding-left:18px;color:#4a433c;">${itemsHtml}</ul>`,
      ],
      ctaLabel: 'View order confirmation',
      ctaHref: input.confirmationUrl,
      footerNote: escapeHtml(
        'We will update you as your order moves through processing and delivery.',
      ),
    }),
  };
}
