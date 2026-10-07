import { ConsoleEmailProvider, createEmailProvider } from './email.provider';
import { SesEmailProvider } from './ses-email.provider';

describe('ConsoleEmailProvider', () => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  afterEach(() => {
    log.mockClear();
    delete process.env.EMAIL_LOG_BODY;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    log.mockRestore();
  });

  it('logs body when EMAIL_LOG_BODY=true even in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_LOG_BODY = 'true';
    const provider = new ConsoleEmailProvider();
    await provider.send({
      to: 'check@check.com',
      subject: 'Zevooria password reset',
      text: 'token-abc',
    });
    expect(log).toHaveBeenCalledWith('token-abc');
  });

  it('omits body in production when EMAIL_LOG_BODY is unset', async () => {
    process.env.NODE_ENV = 'production';
    const provider = new ConsoleEmailProvider();
    await provider.send({
      to: 'check@check.com',
      subject: 'Zevooria password reset',
      text: 'token-abc',
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('body omitted'));
  });
});

describe('createEmailProvider', () => {
  afterEach(() => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.AWS_REGION;
    delete process.env.MAIL_FROM;
  });

  it('returns ConsoleEmailProvider by default', () => {
    delete process.env.EMAIL_PROVIDER;
    expect(createEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it('returns ConsoleEmailProvider when EMAIL_PROVIDER=console', () => {
    process.env.EMAIL_PROVIDER = 'console';
    expect(createEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it('returns SesEmailProvider when EMAIL_PROVIDER=ses', () => {
    process.env.EMAIL_PROVIDER = 'ses';
    process.env.AWS_REGION = 'ap-south-1';
    expect(createEmailProvider()).toBeInstanceOf(SesEmailProvider);
  });
});
