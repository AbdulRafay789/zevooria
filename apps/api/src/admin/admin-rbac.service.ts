import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { isPasswordPolicyValid } from '../common/validation/password';
import { hashPassword } from '../auth/password.util';
import {
  CreateAdminRoleDto,
  CreateAdminStaffDto,
  UpdateAdminRoleDto,
  UpdateAdminStaffDto,
} from './dto/admin-rbac.dto';
import { AdminPermission } from './entities/admin-permission.entity';
import { AdminRole } from './entities/admin-role.entity';
import { AdminSession } from './entities/admin-session.entity';
import { AdminUser } from './entities/admin-user.entity';

@Injectable()
export class AdminRbacService {
  constructor(
    @InjectRepository(AdminPermission)
    private readonly permissions: Repository<AdminPermission>,
    @InjectRepository(AdminRole)
    private readonly roles: Repository<AdminRole>,
    @InjectRepository(AdminUser)
    private readonly admins: Repository<AdminUser>,
    @InjectRepository(AdminSession)
    private readonly sessions: Repository<AdminSession>,
  ) {}

  listPermissions() {
    return this.permissions.find({ order: { code: 'ASC' } });
  }

  async listRoles() {
    const roles = await this.roles.find({
      relations: { permissions: true },
      order: { code: 'ASC' },
    });
    return roles.map((role) => this.toRoleView(role));
  }

  async createRole(dto: CreateAdminRoleDto) {
    const code = dto.code.trim().toLowerCase();
    const existing = await this.roles.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException('Role code already exists.');
    }
    const role = this.roles.create({
      code,
      name: dto.name.trim(),
      permissions: await this.resolvePermissions(dto.permissionCodes ?? []),
    });
    await this.roles.save(role);
    return this.getRole(role.id);
  }

  async updateRole(id: string, dto: UpdateAdminRoleDto) {
    const role = await this.roles.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!role) {
      throw new NotFoundException('Role not found.');
    }
    if (dto.name !== undefined) {
      role.name = dto.name.trim();
    }
    if (dto.permissionCodes !== undefined) {
      role.permissions = await this.resolvePermissions(dto.permissionCodes);
    }
    await this.roles.save(role);
    return this.getRole(id);
  }

  async listStaff() {
    const rows = await this.admins.find({
      relations: { roles: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map((admin) => this.toStaffView(admin));
  }

  async createStaff(dto: CreateAdminStaffDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.admins.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Staff email already exists.');
    }
    if (!isPasswordPolicyValid(dto.password)) {
      throw new BadRequestException(
        'Password must be at least 8 characters and contain at least 2 special characters.',
      );
    }
    const admin = this.admins.create({
      email,
      fullName: dto.fullName.trim(),
      passwordHash: await hashPassword(dto.password),
      role: 'admin',
      isActive: dto.isActive ?? true,
      roles: await this.resolveRoles(dto.roleIds ?? []),
    });
    await this.admins.save(admin);
    return this.getStaff(admin.id);
  }

  async updateStaff(id: string, dto: UpdateAdminStaffDto) {
    const admin = await this.admins.findOne({
      where: { id },
      relations: { roles: true },
    });
    if (!admin) {
      throw new NotFoundException('Staff user not found.');
    }
    if (dto.fullName !== undefined) {
      admin.fullName = dto.fullName.trim();
    }
    if (dto.isActive !== undefined) {
      admin.isActive = dto.isActive;
      if (!dto.isActive) {
        await this.sessions.delete({ adminUserId: admin.id });
      }
    }
    if (dto.password !== undefined) {
      if (!isPasswordPolicyValid(dto.password)) {
        throw new BadRequestException(
          'Password must be at least 8 characters and contain at least 2 special characters.',
        );
      }
      admin.passwordHash = await hashPassword(dto.password);
      await this.sessions.delete({ adminUserId: admin.id });
    }
    if (dto.roleIds !== undefined) {
      admin.roles = await this.resolveRoles(dto.roleIds);
    }
    await this.admins.save(admin);
    return this.getStaff(id);
  }

  private async getRole(id: string) {
    const role = await this.roles.findOne({
      where: { id },
      relations: { permissions: true },
    });
    if (!role) {
      throw new NotFoundException('Role not found.');
    }
    return this.toRoleView(role);
  }

  private async getStaff(id: string) {
    const admin = await this.admins.findOne({
      where: { id },
      relations: { roles: true },
    });
    if (!admin) {
      throw new NotFoundException('Staff user not found.');
    }
    return this.toStaffView(admin);
  }

  private async resolvePermissions(codes: string[]) {
    if (codes.length === 0) {
      return [];
    }
    const rows = await this.permissions.find({
      where: { code: In(codes) },
    });
    if (rows.length !== codes.length) {
      throw new BadRequestException(
        'One or more permission codes are invalid.',
      );
    }
    return rows;
  }

  private async resolveRoles(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.roles.find({ where: { id: In(ids) } });
    if (rows.length !== ids.length) {
      throw new BadRequestException('One or more role ids are invalid.');
    }
    return rows;
  }

  private toRoleView(role: AdminRole) {
    return {
      id: role.id,
      code: role.code,
      name: role.name,
      permissionCodes: (role.permissions ?? []).map((p) => p.code).sort(),
      createdAt: role.createdAt.toISOString(),
    };
  }

  private toStaffView(admin: AdminUser) {
    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.fullName,
      isActive: admin.isActive,
      role: admin.role,
      roles: (admin.roles ?? []).map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
      })),
      createdAt: admin.createdAt.toISOString(),
    };
  }
}
