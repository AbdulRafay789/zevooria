import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductStatus } from './catalog.enums';
import { Product } from './entities/product.entity';
import { ProductMedia } from './entities/product-media.entity';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const find = jest.fn();
  const findOne = jest.fn();
  const save = jest.fn();
  const mediaFind = jest.fn();

  let service: ProductsService;

  beforeEach(async () => {
    find.mockReset();
    findOne.mockReset();
    save.mockReset();
    mediaFind.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: { find, findOne, save },
        },
        {
          provide: getRepositoryToken(ProductMedia),
          useValue: { find: mediaFind, manager: { transaction: jest.fn() } },
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

  it('updates description for admin', async () => {
    const product = {
      id: 'p1',
      name: 'Test',
      slug: 'test',
      description: 'Old',
      price: '1000.00',
      status: ProductStatus.ACTIVE,
      media: [],
      updatedAt: new Date(),
    };
    findOne
      .mockResolvedValueOnce(product)
      .mockResolvedValueOnce({ ...product, description: 'Fresh notes.' });
    save.mockResolvedValue(product);

    const updated = await service.updateForAdmin('p1', {
      description: '  Fresh notes.  ',
    });
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Fresh notes.' }),
    );
    expect(updated.description).toBe('Fresh notes.');
  });

  it('removes media and promotes the next image to primary', async () => {
    const primary = {
      id: 'm1',
      productId: 'p1',
      isPrimary: true,
      sortOrder: 0,
      storageKey: 'assets/test/a.jpeg',
    };
    const secondary = {
      id: 'm2',
      productId: 'p1',
      isPrimary: false,
      sortOrder: 1,
      storageKey: 'assets/test/b.jpeg',
    };
    const product = {
      id: 'p1',
      name: 'Test',
      slug: 'test',
      media: [primary, secondary],
    };
    const managerDelete = jest.fn().mockResolvedValue(undefined);
    const managerFind = jest.fn().mockResolvedValue([{ ...secondary }]);
    const managerSave = jest.fn((row: { isPrimary: boolean }) =>
      Promise.resolve(row),
    );
    const mediaRepo = {
      find: mediaFind,
      manager: {
        transaction: jest.fn((fn: (m: unknown) => unknown) =>
          Promise.resolve(
            fn({
              delete: managerDelete,
              find: managerFind,
              save: managerSave,
            }),
          ),
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: { find, findOne, save },
        },
        {
          provide: getRepositoryToken(ProductMedia),
          useValue: mediaRepo,
        },
      ],
    }).compile();
    const local = module.get(ProductsService);

    findOne.mockResolvedValueOnce(product).mockResolvedValueOnce({
      ...product,
      media: [{ ...secondary, isPrimary: true }],
    });

    const updated = await local.removeImageForAdmin('p1', 'm1');
    expect(managerDelete).toHaveBeenCalledWith(ProductMedia, {
      id: 'm1',
      productId: 'p1',
    });
    expect(managerSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm2', isPrimary: true }),
    );
    expect(updated.media?.[0]?.isPrimary).toBe(true);
  });
});
