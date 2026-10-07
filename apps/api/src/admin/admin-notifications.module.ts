import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminNotificationsService } from './admin-notifications.service';
import { AdminNotification } from './entities/admin-notification.entity';
import { AdminNotificationReceipt } from './entities/admin-notification-receipt.entity';
import { AdminNotificationPreferences } from './entities/admin-notification-preferences.entity';
import { AdminPushSubscription } from './entities/admin-push-subscription.entity';
import { AdminUser } from './entities/admin-user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminNotification,
      AdminNotificationReceipt,
      AdminNotificationPreferences,
      AdminPushSubscription,
      AdminUser,
    ]),
  ],
  providers: [AdminNotificationsService],
  exports: [AdminNotificationsService],
})
export class AdminNotificationsModule {}
