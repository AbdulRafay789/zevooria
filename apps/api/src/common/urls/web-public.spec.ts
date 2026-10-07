import { productPageUrl } from './web-public';

describe('productPageUrl', () => {
  it('builds a storefront product URL from WEB_PUBLIC_URL', () => {
    expect(
      productPageUrl('roselle', { WEB_PUBLIC_URL: 'https://zevooria.com/' }),
    ).toBe('https://zevooria.com/products/roselle');
  });

  it('defaults to localhost for local development', () => {
    expect(productPageUrl('noir', {})).toBe(
      'http://localhost:3000/products/noir',
    );
  });
});
