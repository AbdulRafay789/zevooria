import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductStatus } from './catalog.enums';
import { Product } from './entities/product.entity';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const find = jest.fn();
  const findOne = jest.fn();

  let service: ProductsService;

  beforeEach(async () => {
    find.mockReset();
    findOne.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: { find, findOne },
        },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  it('lists only active products with media', async () => {
    find.mockResolvedValue([]);
    await service.findActivePublished();
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: ProductStatus.ACTIVE },
        relations: { media: true },
      }),
    );
  });

  it('throws when active product slug is missing', async () => {
    findOne.mockResolvedValue(null);
    await expect(service.findActiveBySlug('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
