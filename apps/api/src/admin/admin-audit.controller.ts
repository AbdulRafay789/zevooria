import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AdminGuard } from './admin.guard';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@Controller('admin/audit-logs')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit:read')
  async list(
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
  ) {
    const parsedLimit = limitRaw ? Number(limitRaw) : 500;
    const parsedOffset = offsetRaw ? Number(offsetRaw) : 0;
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 500;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
    return this.auditService.listPage({ limit, offset });
  }
}
