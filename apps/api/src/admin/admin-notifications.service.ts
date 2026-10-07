import { Injectable, Logger, MessageEvent, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter } from 'node:events';
import { Observable } from 'rxjs';
import { In, IsNull, Repository } from 'typeorm';
import * as webpush from 'web-push';
import { AdminUser } from './entities/admin-user.entity';
import { AdminNotification } from './entities/admin-notification.entity';
import { AdminNotificationReceipt } from './entities/admin-notification-receipt.entity';
import { AdminNotificationPreferences } from './entities/admin-notification-preferences.entity';
import { AdminPushSubscription } from './entities/admin-push-subscription.entity';

export type AdminNotificationView = {
  id: string;
  type: string;
  title: string;
  body: string;
  resourceType: string | null;
  resourceId: string | null;
  createdAt: string;
  readAt: string | null;
};

@Injectable()
export class AdminNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(AdminNotificationsService.name);
  private readonly bus = new EventEmitter();
  private pushConfigured = false;

  constructor(
    @InjectRepository(AdminNotification)
    private readonly notifications: Repository<AdminNotification>,
    @InjectRepository(AdminNotificationReceipt)
    private readonly receipts: Repository<AdminNotificationReceipt>,
    @InjectRepository(AdminNotificationPreferences)
    private readonly preferences: Repository<AdminNotificationPreferences>,
    @InjectRepository(AdminPushSubscription)
    private readonly pushSubs: Repository<AdminPushSubscription>,
    @InjectRepository(AdminUser)
    private readonly adminUsers: Repository<AdminUser>,
  ) {
    this.bus.setMaxListeners(100);
  }

  onModuleInit(): void {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? 'mailto:ops@zevooria.com';
    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.pushConfigured = true;
    } else {
      this.logger.warn(
        'VAPID keys not configured — Web Push disabled until VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set.',
      );
    }
  }

  getVapidPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY ?? null;
  }

  streamForAdmin(adminUserId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const handler = (payload: {
        adminUserId: string;
        notification: AdminNotificationView;
      }) => {
        if (payload.adminUserId !== adminUserId) {
          return;
        }
        subscriber.next({
          data: JSON.stringify(payload.notification),
        });
      };
      this.bus.on('notification', handler);
      subscriber.next({
        data: JSON.stringify({ type: 'connected' }),
      });
      return () => {
        this.bus.off('notification', handler);
      };
    });
  }

  async listForAdmin(
    adminUserId: string,
    limit = 40,
  ): Promise<AdminNotificationView[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.receipts
      .createQueryBuilder('receipt')
      .innerJoinAndSelect('receipt.notification', 'notification')
      .where('receipt.adminUserId = :adminUserId', { adminUserId })
      .orderBy('notification.createdAt', 'DESC')
      .take(take)
      .getMany();
    return rows.map((row) => this.toView(row.notification, row.readAt));
  }

  async unreadCount(adminUserId: string): Promise<number> {
    return this.receipts.count({
      where: { adminUserId, readAt: IsNull() },
    });
  }

  async markRead(
    adminUserId: string,
    notificationId: string,
  ): Promise<AdminNotificationView | null> {
    const receipt = await this.receipts.findOne({
      where: { adminUserId, notificationId },
      relations: { notification: true },
    });
    if (!receipt) {
      return null;
    }
    if (!receipt.readAt) {
      receipt.readAt = new Date();
      await this.receipts.save(receipt);
    }
    return this.toView(receipt.notification, receipt.readAt);
  }

  async markAllRead(adminUserId: string): Promise<number> {
    const result = await this.receipts.update(
      { adminUserId, readAt: IsNull() },
      { readAt: new Date() },
    );
    return result.affected ?? 0;
  }

  async getPreferences(
    adminUserId: string,
  ): Promise<AdminNotificationPreferences> {
    let prefs = await this.preferences.findOne({ where: { adminUserId } });
    if (!prefs) {
      prefs = this.preferences.create({
        adminUserId,
        orderPlaced: true,
        pushEnabled: false,
      });
      await this.preferences.save(prefs);
    }
    return prefs;
  }

  async updatePreferences(
    adminUserId: string,
    input: { orderPlaced?: boolean; pushEnabled?: boolean },
  ): Promise<AdminNotificationPreferences> {
    const prefs = await this.getPreferences(adminUserId);
    if (input.orderPlaced !== undefined) {
      prefs.orderPlaced = input.orderPlaced;
    }
    if (input.pushEnabled !== undefined) {
      prefs.pushEnabled = input.pushEnabled;
    }
    return this.preferences.save(prefs);
  }

  async savePushSubscription(
    adminUserId: string,
    input: { endpoint: string; p256dh: string; auth: string },
  ): Promise<void> {
    const existing = await this.pushSubs.findOne({
      where: { endpoint: input.endpoint },
    });
    if (existing) {
      existing.adminUserId = adminUserId;
      existing.p256dh = input.p256dh;
      existing.auth = input.auth;
      await this.pushSubs.save(existing);
      return;
    }
    await this.pushSubs.save(
      this.pushSubs.create({
        adminUserId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
      }),
    );
  }

  async removePushSubscription(
    adminUserId: string,
    endpoint: string,
  ): Promise<void> {
    await this.pushSubs.delete({ adminUserId, endpoint });
  }

  async notifyOrderPlaced(input: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    totalPkr: string;
  }): Promise<void> {
    const title = `New order ${input.orderNumber}`;
    const body = `${input.customerName} · PKR ${input.totalPkr}`;
    const notification = await this.notifications.save(
      this.notifications.create({
        type: 'order.placed',
        title,
        body,
        resourceType: 'order',
        resourceId: input.orderId,
      }),
    );

    const recipientIds = await this.findOrderNotificationRecipients();
    if (recipientIds.length === 0) {
      return;
    }

    const receipts = recipientIds.map((adminUserId) =>
      this.receipts.create({
        notificationId: notification.id,
        adminUserId,
        readAt: null,
      }),
    );
    await this.receipts.save(receipts);

    const view = this.toView(notification, null);
    for (const adminUserId of recipientIds) {
      this.bus.emit('notification', { adminUserId, notification: view });
    }

    await this.sendPushToRecipients(recipientIds, title, body);
  }

  private async findOrderNotificationRecipients(): Promise<string[]> {
    const rows = await this.adminUsers
      .createQueryBuilder('admin')
      .innerJoin('admin.roles', 'role')
      .innerJoin('role.permissions', 'perm')
      .where('admin.isActive = true')
      .andWhere('perm.code = :code', { code: 'notifications:read' })
      .select('admin.id', 'id')
      .distinct(true)
      .getRawMany<{ id: string }>();

    const ids = rows.map((row) => row.id);
    if (ids.length === 0) {
      return [];
    }

    const prefs = await this.preferences.find({
      where: { adminUserId: In(ids) },
    });
    const prefsById = new Map(prefs.map((p) => [p.adminUserId, p]));
    return ids.filter((id) => {
      const pref = prefsById.get(id);
      return pref ? pref.orderPlaced : true;
    });
  }

  private async sendPushToRecipients(
    adminUserIds: string[],
    title: string,
    body: string,
  ): Promise<void> {
    if (!this.pushConfigured || adminUserIds.length === 0) {
      return;
    }
    const enabledPrefs = await this.preferences.find({
      where: { adminUserId: In(adminUserIds), pushEnabled: true },
    });
    const enabledIds = enabledPrefs.map((p) => p.adminUserId);
    if (enabledIds.length === 0) {
      return;
    }
    const subs = await this.pushSubs.find({
      where: { adminUserId: In(enabledIds) },
    });
    const payload = JSON.stringify({ title, body, url: '/orders' });
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
      } catch (err: unknown) {
        const statusCode =
          err && typeof err === 'object' && 'statusCode' in err
            ? Number((err as { statusCode: number }).statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await this.pushSubs.delete({ id: sub.id });
        } else {
          this.logger.warn(
            `Web Push failed for subscription ${sub.id}: ${String(err)}`,
          );
        }
      }
    }
  }

  private toView(
    notification: AdminNotification,
    readAt: Date | null,
  ): AdminNotificationView {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
      createdAt: notification.createdAt.toISOString(),
      readAt: readAt ? readAt.toISOString() : null,
    };
  }
}
