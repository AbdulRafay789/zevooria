/**
 * Controlled Pakistan city list for MVP checkout / shipping addresses.
 * Keep alphabetized. Frontend and API validation must stay in sync.
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
