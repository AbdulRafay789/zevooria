import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Sse,
  UseGuards,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminGuard, type AdminAuthenticatedRequest } from './admin.guard';
import { RequirePermissions } from './permissions.decorator';
import { PermissionsGuard } from './permissions.guard';

class PushSubscribeDto {
  @IsString()
  @MaxLength(2000)
  endpoint!: string;

  @IsString()
  @MaxLength(500)
  p256dh!: string;

  @IsString()
  @MaxLength(500)
  auth!: string;
}

class NotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  orderPlaced?: boolean;

  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;
}

@Controller('admin/notifications')
@UseGuards(AdminGuard, PermissionsGuard)
export class AdminNotificationsController {
  constructor(
    private readonly notificationsService: AdminNotificationsService,
  ) {}

  @Get('vapid-public-key')
  @RequirePermissions('notifications:read')
  vapidPublicKey() {
    return { publicKey: this.notificationsService.getVapidPublicKey() };
  }

  @Sse('stream')
  @RequirePermissions('notifications:read')
  stream(
    @Req() req: Request & AdminAuthenticatedRequest,
  ): Observable<MessageEvent> {
    return this.notificationsService.streamForAdmin(req.admin!.id);
  }

  @Get()
  @RequirePermissions('notifications:read')
  async list(
    @Req() req: Request & AdminAuthenticatedRequest,
    @Query('limit') limitRaw?: string,
  ) {
    const parsed = limitRaw ? Number(limitRaw) : 40;
    const limit = Number.isFinite(parsed) ? parsed : 40;
    const [items, unreadCount] = await Promise.all([
      this.notificationsService.listForAdmin(req.admin!.id, limit),
      this.notificationsService.unreadCount(req.admin!.id),
    ]);
    return { items, unreadCount };
  }

  @Get('preferences')
  @RequirePermissions('notifications:read')
  async getPreferences(@Req() req: Request & AdminAuthenticatedRequest) {
    const prefs = await this.notificationsService.getPreferences(req.admin!.id);
    return {
      orderPlaced: prefs.orderPlaced,
      pushEnabled: prefs.pushEnabled,
    };
  }

  @Patch('preferences')
  @RequirePermissions('notifications:read')
  async updatePreferences(
    @Req() req: Request & AdminAuthenticatedRequest,
    @Body() body: NotificationPreferencesDto,
  ) {
    const prefs = await this.notificationsService.updatePreferences(
      req.admin!.id,
      body,
    );
    return {
      orderPlaced: prefs.orderPlaced,
      pushEnabled: prefs.pushEnabled,
    };
  }

  @Patch(':id/read')
  @RequirePermissions('notifications:read')
  async markRead(
    @Req() req: Request & AdminAuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const view = await this.notificationsService.markRead(req.admin!.id, id);
    if (!view) {
      throw new NotFoundException('Notification not found.');
    }
    return view;
  }

  @Post('read-all')
  @RequirePermissions('notifications:read')
  async markAllRead(@Req() req: Request & AdminAuthenticatedRequest) {
    const updated = await this.notificationsService.markAllRead(req.admin!.id);
    return { updated };
  }

  @Post('push-subscribe')
  @RequirePermissions('notifications:read')
  async pushSubscribe(
    @Req() req: Request & AdminAuthenticatedRequest,
    @Body() body: PushSubscribeDto,
  ) {
    await this.notificationsService.savePushSubscription(req.admin!.id, body);
    return { ok: true };
  }

  @Delete('push-subscribe')
  @RequirePermissions('notifications:read')
  async pushUnsubscribe(
    @Req() req: Request & AdminAuthenticatedRequest,
    @Body() body: { endpoint: string },
  ) {
    if (body?.endpoint) {
      await this.notificationsService.removePushSubscription(
        req.admin!.id,
        body.endpoint,
      );
    }
    return { ok: true };
  }
}
