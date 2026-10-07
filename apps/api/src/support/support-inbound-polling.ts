/**
 * Explicit SUPPORT_INBOUND_POLLING_ENABLED wins.
 * Otherwise: off for local EMAIL_PROVIDER=console (no AWS credentials),
 * on for EMAIL_PROVIDER=ses (EC2 IAM role).
 */
export function isSupportInboundPollingEnabled(): boolean {
  const raw = process.env.SUPPORT_INBOUND_POLLING_ENABLED?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') {
    return false;
  }
  if (raw === '1' || raw === 'true' || raw === 'on') {
    return true;
  }
  const emailProvider = (process.env.EMAIL_PROVIDER ?? 'console')
    .trim()
    .toLowerCase();
  return emailProvider === 'ses';
}
