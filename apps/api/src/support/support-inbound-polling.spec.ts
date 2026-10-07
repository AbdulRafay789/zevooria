import { isSupportInboundPollingEnabled } from './support-inbound-polling';

describe('isSupportInboundPollingEnabled', () => {
  const originalPolling = process.env.SUPPORT_INBOUND_POLLING_ENABLED;
  const originalEmail = process.env.EMAIL_PROVIDER;

  afterEach(() => {
    if (originalPolling === undefined) {
      delete process.env.SUPPORT_INBOUND_POLLING_ENABLED;
    } else {
      process.env.SUPPORT_INBOUND_POLLING_ENABLED = originalPolling;
    }
    if (originalEmail === undefined) {
      delete process.env.EMAIL_PROVIDER;
    } else {
      process.env.EMAIL_PROVIDER = originalEmail;
    }
  });

  it('defaults off for local console email provider', () => {
    delete process.env.SUPPORT_INBOUND_POLLING_ENABLED;
    process.env.EMAIL_PROVIDER = 'console';
    expect(isSupportInboundPollingEnabled()).toBe(false);
  });

  it('defaults on when EMAIL_PROVIDER=ses', () => {
    delete process.env.SUPPORT_INBOUND_POLLING_ENABLED;
    process.env.EMAIL_PROVIDER = 'ses';
    expect(isSupportInboundPollingEnabled()).toBe(true);
  });

  it('allows explicit disable even with EMAIL_PROVIDER=ses', () => {
    process.env.EMAIL_PROVIDER = 'ses';
    process.env.SUPPORT_INBOUND_POLLING_ENABLED = 'false';
    expect(isSupportInboundPollingEnabled()).toBe(false);
  });

  it('allows explicit enable even with EMAIL_PROVIDER=console', () => {
    process.env.EMAIL_PROVIDER = 'console';
    process.env.SUPPORT_INBOUND_POLLING_ENABLED = 'true';
    expect(isSupportInboundPollingEnabled()).toBe(true);
  });
});
