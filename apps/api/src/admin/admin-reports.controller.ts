import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { AdminGuard } from './admin.guard';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@Controller('admin/reports')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminReportsController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions('dashboard:read')
  getSummary() {
    return this.ordersService.reportsSummary();
  }
}
