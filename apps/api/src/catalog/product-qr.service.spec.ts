import { ProductQrService } from './product-qr.service';

describe('ProductQrService', () => {
  const previous = process.env.WEB_PUBLIC_URL;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.WEB_PUBLIC_URL;
    } else {
      process.env.WEB_PUBLIC_URL = previous;
    }
  });

  it('builds the storefront product URL', () => {
    process.env.WEB_PUBLIC_URL = 'https://shop.example';
    const service = new ProductQrService();
    expect(service.productUrl('roselle')).toBe(
      'https://shop.example/products/roselle',
    );
  });

  it('renders a PNG buffer for a slug', async () => {
    process.env.WEB_PUBLIC_URL = 'https://shop.example';
    const service = new ProductQrService();
    const buffer = await service.pngBuffer('roselle', 256);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe(true);
  });
});
