import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  auditRequestFromHeaders,
  AuditService,
  clientIpFromRequest,
} from '../audit/audit.service';
import { AdminGuard, type AdminAuthenticatedRequest } from './admin.guard';
import { AdminRbacService } from './admin-rbac.service';
import {
  CreateAdminRoleDto,
  CreateAdminStaffDto,
  UpdateAdminRoleDto,
  UpdateAdminStaffDto,
} from './dto/admin-rbac.dto';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@Controller('admin')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminRbacController {
  constructor(
    private readonly rbac: AdminRbacService,
    private readonly auditService: AuditService,
  ) {}

  @Get('permissions')
  @RequirePermissions('admins:manage')
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @Get('roles')
  @RequirePermissions('admins:manage')
  listRoles() {
    return this.rbac.listRoles();
  }

  @Post('roles')
  @RequirePermissions('admins:manage')
  async createRole(
    @Body() body: CreateAdminRoleDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const role = await this.rbac.createRole(body);
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'admin.role_create',
      resourceType: 'admin_role',
      resourceId: role.id,
      metadata: { code: role.code },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return role;
  }

  @Patch('roles/:id')
  @RequirePermissions('admins:manage')
  async updateRole(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateAdminRoleDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const role = await this.rbac.updateRole(id, body);
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'admin.role_update',
      resourceType: 'admin_role',
      resourceId: role.id,
      metadata: { code: role.code },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return role;
  }

  @Get('staff')
  @RequirePermissions('admins:manage')
  listStaff() {
    return this.rbac.listStaff();
  }

  @Post('staff')
  @RequirePermissions('admins:manage')
  async createStaff(
    @Body() body: CreateAdminStaffDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const staff = await this.rbac.createStaff(body);
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'admin.staff_create',
      resourceType: 'admin_user',
      resourceId: staff.id,
      metadata: { email: staff.email },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return staff;
  }

  @Patch('staff/:id')
  @RequirePermissions('admins:manage')
  async updateStaff(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateAdminStaffDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const staff = await this.rbac.updateStaff(id, body);
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: 'admin.staff_update',
      resourceType: 'admin_user',
      resourceId: staff.id,
      metadata: { email: staff.email },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return staff;
  }
}
