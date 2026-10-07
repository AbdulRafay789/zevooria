import { detectImageType } from './image-sniff';

describe('detectImageType', () => {
  it('detects JPEG from magic bytes', () => {
    const buf = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    expect(detectImageType(buf)).toBe('jpeg');
  });

  it('detects PNG from magic bytes', () => {
    const buf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    expect(detectImageType(buf)).toBe('png');
  });

  it('detects WebP from RIFF/WEBP header', () => {
    const buf = Buffer.alloc(12);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(0, 4);
    buf.write('WEBP', 8);
    expect(detectImageType(buf)).toBe('webp');
  });

  it('rejects GIF and short buffers', () => {
    const gif = Buffer.from('GIF89a......');
    expect(detectImageType(gif)).toBeNull();
    expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});
