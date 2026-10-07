import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { productPageUrl } from '../common/urls/web-public';

@Injectable()
export class ProductQrService {
  productUrl(slug: string): string {
    return productPageUrl(slug);
  }

  async pngBuffer(slug: string, size = 512): Promise<Buffer> {
    const url = this.productUrl(slug);
    const px = Math.min(Math.max(size, 128), 2048);
    return QRCode.toBuffer(url, {
      type: 'png',
      width: px,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1c1915',
        light: '#ffffff',
      },
    });
  }
}
