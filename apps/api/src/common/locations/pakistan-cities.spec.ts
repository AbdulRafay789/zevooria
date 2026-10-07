import { PAKISTAN_CITIES, isPakistanCity } from './pakistan-cities';

describe('pakistan cities', () => {
  it('includes the required MVP cities and stays alphabetized', () => {
    expect(PAKISTAN_CITIES).toEqual(
      [...PAKISTAN_CITIES].sort((a, b) => a.localeCompare(b)),
    );
    expect(PAKISTAN_CITIES).toEqual(
      expect.arrayContaining([
        'Karachi',
        'Lahore',
        'Islamabad',
        'Rawalpindi',
        'Faisalabad',
        'Multan',
        'Peshawar',
        'Quetta',
        'Hyderabad',
        'Gujranwala',
        'Sialkot',
        'Bahawalpur',
        'Sargodha',
        'Sukkur',
        'Abbottabad',
        'Mardan',
        'Mingora',
        'Larkana',
        'Nawabshah',
        'Rahim Yar Khan',
      ]),
    );
  });

  it('rejects unsupported cities', () => {
    expect(isPakistanCity('Lahore')).toBe(true);
    expect(isPakistanCity('Atlantis')).toBe(false);
    expect(isPakistanCity('')).toBe(false);
  });
});
