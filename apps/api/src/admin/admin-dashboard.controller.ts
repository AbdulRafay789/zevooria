import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { AdminGuard } from './admin.guard';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@Controller('admin/dashboard')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminDashboardController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @RequirePermissions('dashboard:read')
  getStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.ordersService.dashboardStats({ from, to, status });
  }
}
