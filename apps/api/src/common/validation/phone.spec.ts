import {
  isValidPakistanPhone,
  normalizePakistanPhone,
  PK_PHONE_MESSAGE,
  PK_PHONE_NATIONAL_LENGTH,
  PK_PHONE_PREFIX,
  toPakistanNationalDisplay,
} from './phone';

describe('Pakistan phone validation', () => {
  it('normalizes 11-digit national numbers with fixed +92', () => {
    expect(normalizePakistanPhone('03001234567')).toBe('+923001234567');
    expect(normalizePakistanPhone('+92 300 1234567')).toBe('+923001234567');
    expect(normalizePakistanPhone('923001234567')).toBe('+923001234567');
  });

  it('rejects 10-digit numbers and invalid prefixes', () => {
    expect(normalizePakistanPhone('3001234567')).toBeNull();
    expect(normalizePakistanPhone('0300123456')).toBeNull();
    expect(normalizePakistanPhone('02001234567')).toBeNull();
    expect(normalizePakistanPhone('12345')).toBeNull();
    expect(isValidPakistanPhone('03001234567')).toBe(true);
    expect(isValidPakistanPhone('3001234567')).toBe(false);
  });

  it('exposes national display for the locked +92 field', () => {
    expect(toPakistanNationalDisplay('+923001234567')).toBe('03001234567');
    expect(PK_PHONE_PREFIX).toBe('+92');
    expect(PK_PHONE_NATIONAL_LENGTH).toBe(11);
    expect(PK_PHONE_MESSAGE).toContain('11-digit');
  });
});
