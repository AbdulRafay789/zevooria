import { slugify, uniqueSlug } from './slug.util';

describe('slugify', () => {
  it('creates url-friendly slugs', () => {
    expect(slugify('Signature for Men')).toBe('signature-for-men');
    expect(slugify('Velvet Night Oud')).toBe('velvet-night-oud');
  });
});

describe('uniqueSlug', () => {
  it('keeps the first occurrence and suffixes duplicates', () => {
    const used = new Set<string>();
    expect(uniqueSlug('sabayica', used)).toBe('sabayica');
    expect(uniqueSlug('sabayica', used)).toBe('sabayica-2');
    expect(uniqueSlug('sabayica-golden-sweetness', used)).toBe(
      'sabayica-golden-sweetness',
    );
  });
});
