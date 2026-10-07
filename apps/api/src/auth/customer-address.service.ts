import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  CustomerAddressDto,
  UpdateCustomerAddressDto,
} from './dto/customer-address.dto';
import { CustomerAddress } from './entities/customer-address.entity';

export type CustomerAddressView = {
  id: string;
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class CustomerAddressService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CustomerAddress)
    private readonly addresses: Repository<CustomerAddress>,
  ) {}

  async listForCustomer(customerId: string): Promise<CustomerAddressView[]> {
    const rows = await this.addresses.find({
      where: { customerId },
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async create(
    customerId: string,
    dto: CustomerAddressDto,
  ): Promise<CustomerAddressView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CustomerAddress);
      const count = await repo.count({ where: { customerId } });
      const makeDefault = dto.isDefault === true || count === 0;
      if (makeDefault) {
        await repo.update({ customerId }, { isDefault: false });
      }
      const row = await repo.save(
        repo.create({
          customerId,
          line1: dto.line1.trim(),
          line2: dto.line2?.trim() || null,
          city: dto.city,
          postalCode: dto.postalCode.trim(),
          country: (dto.country?.trim() || 'Pakistan').slice(0, 80),
          isDefault: makeDefault,
        }),
      );
      return this.toView(row);
    });
  }

  async update(
    customerId: string,
    addressId: string,
    dto: UpdateCustomerAddressDto,
  ): Promise<CustomerAddressView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CustomerAddress);
      const row = await repo.findOne({
        where: { id: addressId, customerId },
      });
      if (!row) {
        throw new NotFoundException('Address not found.');
      }
      if (dto.line1 !== undefined) {
        row.line1 = dto.line1.trim();
      }
      if (dto.line2 !== undefined) {
        row.line2 = dto.line2?.trim() || null;
      }
      if (dto.city !== undefined) {
        row.city = dto.city;
      }
      if (dto.postalCode !== undefined) {
        row.postalCode = dto.postalCode.trim();
      }
      if (dto.country !== undefined) {
        row.country = (dto.country?.trim() || 'Pakistan').slice(0, 80);
      }
      if (dto.isDefault === true) {
        await repo.update({ customerId }, { isDefault: false });
        row.isDefault = true;
      } else if (dto.isDefault === false && row.isDefault) {
        throw new BadRequestException(
          'Cannot unset default without selecting another default address.',
        );
      }
      await repo.save(row);
      return this.toView(row);
    });
  }

  async setDefault(
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddressView> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CustomerAddress);
      const row = await repo.findOne({
        where: { id: addressId, customerId },
      });
      if (!row) {
        throw new NotFoundException('Address not found.');
      }
      await repo.update({ customerId }, { isDefault: false });
      row.isDefault = true;
      await repo.save(row);
      return this.toView(row);
    });
  }

  async remove(customerId: string, addressId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CustomerAddress);
      const row = await repo.findOne({
        where: { id: addressId, customerId },
      });
      if (!row) {
        throw new NotFoundException('Address not found.');
      }
      const wasDefault = row.isDefault;
      await repo.remove(row);
      if (wasDefault) {
        const next = await repo.findOne({
          where: { customerId },
          order: { updatedAt: 'DESC' },
        });
        if (next) {
          next.isDefault = true;
          await repo.save(next);
        }
      }
    });
  }

  private toView(row: CustomerAddress): CustomerAddressView {
    return {
      id: row.id,
      line1: row.line1,
      line2: row.line2,
      city: row.city,
      postalCode: row.postalCode,
      country: row.country,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
