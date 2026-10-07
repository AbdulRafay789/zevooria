import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateOrderAddressDto } from './create-order.dto';

describe('CreateOrderAddressDto city validation', () => {
  async function validateCity(city: string) {
    const dto = plainToInstance(CreateOrderAddressDto, {
      line1: '123 Fragrance Street',
      city,
      postalCode: '54000',
      country: 'Pakistan',
    });
    return validate(dto);
  }

  it('accepts a supported Pakistan city', async () => {
    const errors = await validateCity('Lahore');
    expect(errors).toHaveLength(0);
  });

  it('rejects an arbitrary city string', async () => {
    const errors = await validateCity('NotARealCity');
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('City must be a supported');
  });

  it('rejects an empty city', async () => {
    const errors = await validateCity('');
    expect(errors.length).toBeGreaterThan(0);
  });
});
