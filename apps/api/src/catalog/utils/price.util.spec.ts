import { wholePkrToDb } from './price.util';

describe('wholePkrToDb', () => {
  it('formats whole PKR as numeric(12,2) strings', () => {
    expect(wholePkrToDb(999)).toBe('999.00');
    expect(wholePkrToDb(1599)).toBe('1599.00');
    expect(wholePkrToDb(1699)).toBe('1699.00');
  });

  it('rejects non-integer amounts', () => {
    expect(() => wholePkrToDb(15.5)).toThrow(/integer/);
  });
});
