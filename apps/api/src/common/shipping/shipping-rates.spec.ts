import {
  SHIPPING_PKR_KARACHI,
  SHIPPING_PKR_OTHER,
  shippingPkrForCity,
} from './shipping-rates';

describe('shippingPkrForCity', () => {
  it('charges 250 PKR for Karachi', () => {
    expect(shippingPkrForCity('Karachi')).toBe(SHIPPING_PKR_KARACHI);
    expect(shippingPkrForCity('karachi')).toBe(SHIPPING_PKR_KARACHI);
    expect(shippingPkrForCity('  Karachi  ')).toBe(SHIPPING_PKR_KARACHI);
  });

  it('charges 500 PKR for other cities', () => {
    expect(shippingPkrForCity('Lahore')).toBe(SHIPPING_PKR_OTHER);
    expect(shippingPkrForCity('Islamabad')).toBe(SHIPPING_PKR_OTHER);
    expect(shippingPkrForCity('Quetta')).toBe(SHIPPING_PKR_OTHER);
  });
});
