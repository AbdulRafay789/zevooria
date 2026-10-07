/**
 * Server-authoritative COD shipping rates (whole PKR).
 * Karachi: 250; all other Pakistan checkout cities: 500.
 */
export const SHIPPING_PKR_KARACHI = 250;
export const SHIPPING_PKR_OTHER = 500;

export function shippingPkrForCity(city: string): number {
  const normalized = city.trim().toLowerCase();
  if (normalized === 'karachi') {
    return SHIPPING_PKR_KARACHI;
  }
  return SHIPPING_PKR_OTHER;
}
