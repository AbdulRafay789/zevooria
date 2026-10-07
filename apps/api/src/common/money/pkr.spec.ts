import { formatSignedWholePkr, formatWholePkr } from './pkr';

describe('formatSignedWholePkr', () => {
  it('formats positive and negative whole PKR', () => {
    expect(formatSignedWholePkr(0)).toBe('0.00');
    expect(formatSignedWholePkr(1500)).toBe('1500.00');
    expect(formatSignedWholePkr(-150)).toBe('-150.00');
  });

  it('rejects non-integers', () => {
    expect(() => formatSignedWholePkr(1.5)).toThrow(/safe integer/);
    expect(() => formatWholePkr(-1)).toThrow(/non-negative/);
  });
});
