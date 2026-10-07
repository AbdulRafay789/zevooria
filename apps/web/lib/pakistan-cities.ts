/**
 * Controlled Pakistan city list for MVP checkout / shipping addresses.
 * Keep alphabetized. Must stay in sync with API validation list.
 */
export const PAKISTAN_CITIES = [
  'Abbottabad',
  'Bahawalpur',
  'Faisalabad',
  'Gujranwala',
  'Hyderabad',
  'Islamabad',
  'Karachi',
  'Lahore',
  'Larkana',
  'Mardan',
  'Mingora',
  'Multan',
  'Nawabshah',
  'Peshawar',
  'Quetta',
  'Rahim Yar Khan',
  'Rawalpindi',
  'Sargodha',
  'Sialkot',
  'Sukkur',
] as const;

export type PakistanCity = (typeof PAKISTAN_CITIES)[number];

export function isPakistanCity(value: string): value is PakistanCity {
  return (PAKISTAN_CITIES as readonly string[]).includes(value);
}

/** Display estimate only — API is authoritative for order totals. */
export const SHIPPING_PKR_KARACHI = 250;
export const SHIPPING_PKR_OTHER = 500;

export function shippingPkrForCity(city: string): number {
  const normalized = city.trim().toLowerCase();
  if (normalized === 'karachi') {
    return SHIPPING_PKR_KARACHI;
  }
  return SHIPPING_PKR_OTHER;
}
