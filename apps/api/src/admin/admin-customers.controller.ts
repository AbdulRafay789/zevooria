import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import {
  auditRequestFromHeaders,
  AuditService,
  clientIpFromRequest,
} from '../audit/audit.service';
import { Session } from '../auth/entities/session.entity';
import { User } from '../auth/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { UpdateCustomerStatusDto } from './dto/admin-rbac.dto';
import { AdminGuard, type AdminAuthenticatedRequest } from './admin.guard';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

@Controller('admin/customers')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminCustomersController {
  constructor(
    @InjectRepository(User) private readonly customers: Repository<User>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions('customers:read')
  async list() {
    const rows = await this.customers.find({
      order: { createdAt: 'DESC' },
    });
    return rows.map((user) => this.toListItem(user));
  }

  @Get(':id')
  @RequirePermissions('customers:read')
  async getOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const user = await this.customers.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Customer not found.');
    }
    const orderCount = await this.orders.count({ where: { userId: user.id } });
    const recentOrders = await this.orders.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return {
      ...this.toListItem(user),
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      orderCount,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        currency: order.currency,
        createdAt: order.createdAt.toISOString(),
      })),
    };
  }

  @Patch(':id/status')
  @RequirePermissions('customers:update')
  async updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateCustomerStatusDto,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const user = await this.customers.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Customer not found.');
    }
    if (user.deletedAt) {
      if (!body.isActive) {
        throw new BadRequestException(
          'This customer is already deleted. Restore the account to make other status changes.',
        );
      }
      user.deletedAt = null;
      user.isActive = true;
      await this.customers.save(user);
      await this.auditService.record({
        actorType: 'admin',
        actorId: req.admin?.id ?? null,
        action: 'customer.restore',
        resourceType: 'customer',
        resourceId: user.id,
        metadata: { email: user.email },
        request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
      });
      return this.toListItem(user);
    }
    user.isActive = body.isActive;
    await this.customers.save(user);
    if (!body.isActive) {
      await this.sessions.delete({ userId: user.id });
    }
    await this.auditService.record({
      actorType: 'admin',
      actorId: req.admin?.id ?? null,
      action: body.isActive ? 'customer.reactivate' : 'customer.deactivate',
      resourceType: 'customer',
      resourceId: user.id,
      metadata: { email: user.email },
      request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    });
    return this.toListItem(user);
  }

  @Post(':id/delete')
  @RequirePermissions('customers:delete')
  async softDelete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request & AdminAuthenticatedRequest,
  ) {
    const user = await this.customers.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Customer not found.');
    }
    if (!user.deletedAt) {
      user.isActive = false;
      user.deletedAt = new Date();
      await this.customers.save(user);
      await this.sessions.delete({ userId: user.id });
      await this.auditService.record({
        actorType: 'admin',
        actorId: req.admin?.id ?? null,
        action: 'customer.delete',
        resourceType: 'customer',
        resourceId: user.id,
        metadata: { email: user.email },
        request: auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
      });
    }
    return this.toListItem(user);
  }

  private toListItem(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      isActive: user.isActive !== false,
      deletedAt: user.deletedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
