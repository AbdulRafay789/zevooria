import { BadRequestException } from '@nestjs/common';
import { InventoryMovementType } from './inventory.enums';
import { InventoryService } from './inventory.service';

function createService() {
  return new InventoryService(
    {} as never,
    { manager: { transaction: jest.fn() } } as never,
    {} as never,
    {} as never,
  );
}

function createManager(
  stock: {
    quantityOnHand: number;
    quantityReserved: number;
  } | null,
) {
  return {
    getRepository: jest.fn().mockReturnValue({
      findOne: jest.fn().mockResolvedValue({
        id: 'wh-1',
        code: 'main',
        isDefault: true,
        isActive: true,
      }),
    }),
    findOne: jest.fn().mockResolvedValue(stock),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
    create: jest.fn((_entity: unknown, data: unknown) => data),
  };
}

describe('InventoryService.storefrontAvailable', () => {
  const service = createService();

  it('treats stock below 10 as out of stock for the storefront', () => {
    expect(service.storefrontAvailable(0)).toBe(0);
    expect(service.storefrontAvailable(9)).toBe(0);
    expect(service.storefrontAvailable(10)).toBe(10);
    expect(service.storefrontAvailable(25)).toBe(25);
  });
});

describe('InventoryService.reserveForOrder', () => {
  it('rejects when available stock is insufficient', async () => {
    const manager = createManager({
      quantityOnHand: 2,
      quantityReserved: 0,
    });
    manager.findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        quantityOnHand: 2,
        quantityReserved: 0,
      });
    const service = createService();

    await expect(
      service.reserveForOrder(
        manager as never,
        [{ productId: 'p1', quantity: 5, productName: 'Roselle' }],
        'order-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when available stock is below the storefront minimum of 10', async () => {
    const manager = createManager({
      quantityOnHand: 9,
      quantityReserved: 0,
    });
    manager.findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        quantityOnHand: 9,
        quantityReserved: 0,
      });
    const service = createService();

    await expect(
      service.reserveForOrder(
        manager as never,
        [{ productId: 'p1', quantity: 1, productName: 'Roselle' }],
        'order-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('increments reserved and records a reservation movement', async () => {
    const stock = {
      quantityOnHand: 10,
      quantityReserved: 0,
      warehouseId: 'wh-1',
      productId: 'p1',
    };
    const manager = createManager(stock);
    manager.findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stock);
    const service = createService();

    await service.reserveForOrder(
      manager as never,
      [{ productId: 'p1', quantity: 3, productName: 'Roselle' }],
      'order-1',
    );

    expect(stock.quantityOnHand).toBe(10);
    expect(stock.quantityReserved).toBe(3);
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: InventoryMovementType.RESERVATION,
        quantityDelta: 3,
        quantityAfter: 10,
        referenceType: 'order',
        referenceId: 'order-1',
      }),
    );
  });
});

describe('InventoryService.consumeReservedForSale', () => {
  it('converts reservation into a sale', async () => {
    const stock = {
      quantityOnHand: 10,
      quantityReserved: 3,
      warehouseId: 'wh-1',
      productId: 'p1',
    };
    const manager = createManager(stock);
    manager.findOne = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stock);
    const service = createService();

    await service.consumeReservedForSale(
      manager as never,
      [{ productId: 'p1', quantity: 3, productName: 'Roselle' }],
      'order-1',
    );

    expect(stock.quantityOnHand).toBe(7);
    expect(stock.quantityReserved).toBe(0);
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: InventoryMovementType.SALE,
        quantityDelta: -3,
        quantityAfter: 7,
        referenceType: 'order',
        referenceId: 'order-1',
      }),
    );
  });

  it('is idempotent when a sale movement already exists', async () => {
    const manager = createManager({
      quantityOnHand: 7,
      quantityReserved: 0,
    });
    manager.findOne = jest.fn().mockResolvedValue({
      id: 'move-sale',
      type: InventoryMovementType.SALE,
      referenceType: 'order',
      referenceId: 'order-1',
    });
    const service = createService();

    await service.consumeReservedForSale(
      manager as never,
      [{ productId: 'p1', quantity: 3, productName: 'Roselle' }],
      'order-1',
    );

    expect(manager.save).not.toHaveBeenCalled();
  });
});

describe('InventoryService.releaseOrRestoreOnCancel', () => {
  it('releases reservation when no sale exists', async () => {
    const stock = {
      quantityOnHand: 10,
      quantityReserved: 3,
      warehouseId: 'wh-1',
      productId: 'p1',
    };
    const manager = createManager(stock);
    manager.findOne = jest
      .fn()
      .mockResolvedValueOnce(null) // hasOrderSaleMovement
      .mockResolvedValueOnce(null) // alreadyReleased
      .mockResolvedValueOnce(null) // hasOrderSale again in release
      .mockResolvedValueOnce(stock);
    const service = createService();

    await service.releaseOrRestoreOnCancel(
      manager as never,
      [{ productId: 'p1', quantity: 3, productName: 'Roselle' }],
      'order-1',
    );

    expect(stock.quantityOnHand).toBe(10);
    expect(stock.quantityReserved).toBe(0);
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: InventoryMovementType.RELEASE,
        quantityDelta: -3,
        referenceId: 'order-1',
      }),
    );
  });

  it('restores on-hand when a sale already exists', async () => {
    const stock = {
      quantityOnHand: 7,
      quantityReserved: 0,
      warehouseId: 'wh-1',
      productId: 'p1',
    };
    const manager = createManager(stock);
    manager.findOne = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'move-sale',
        type: InventoryMovementType.SALE,
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stock);
    const service = createService();

    await service.releaseOrRestoreOnCancel(
      manager as never,
      [{ productId: 'p1', quantity: 3, productName: 'Roselle' }],
      'order-1',
    );

    expect(stock.quantityOnHand).toBe(10);
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: InventoryMovementType.RECEIPT,
        referenceType: 'order_cancel',
        referenceId: 'order-1',
      }),
    );
  });
});

describe('InventoryService.restoreForCancel', () => {
  it('is idempotent when cancel restore already recorded', async () => {
    const manager = createManager({
      quantityOnHand: 10,
      quantityReserved: 0,
    });
    manager.findOne = jest.fn().mockResolvedValue({
      id: 'move-1',
      referenceType: 'order_cancel',
      referenceId: 'order-1',
    });
    const service = createService();

    await service.restoreForCancel(
      manager as never,
      [{ productId: 'p1', quantity: 3, productName: 'Roselle' }],
      'order-1',
    );

    expect(manager.save).not.toHaveBeenCalled();
  });
});
