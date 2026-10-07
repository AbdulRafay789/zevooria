import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUser } from '../admin/entities/admin-user.entity';
import { AuditModule } from '../audit/audit.module';
import { User } from '../auth/entities/user.entity';
import { SupportAttachment } from './entities/support-attachment.entity';
import { SupportConversation } from './entities/support-conversation.entity';
import { SupportInboundObject } from './entities/support-inbound-object.entity';
import { SupportMessage } from './entities/support-message.entity';
import { SupportAdminService } from './support-admin.service';
import { SupportInboundScheduler } from './support-inbound.scheduler';
import { SupportInboundService } from './support-inbound.service';
import { SupportOutboundService } from './support-outbound.service';
import { createSupportS3Client, SUPPORT_S3_CLIENT } from './support-s3.client';

/**
 * Support inbox domain.
 * Phase 2: inbound S3 polling + MIME ingestion.
 * Phase 3–5: admin API, attachment access, outbound SES replies.
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      SupportConversation,
      SupportMessage,
      SupportAttachment,
      SupportInboundObject,
      User,
      AdminUser,
    ]),
    AuditModule,
  ],
  providers: [
    {
      provide: SUPPORT_S3_CLIENT,
      useFactory: () => createSupportS3Client(),
    },
    SupportInboundService,
    SupportInboundScheduler,
    SupportOutboundService,
    SupportAdminService,
  ],
  exports: [TypeOrmModule, SupportInboundService, SupportAdminService],
})
export class SupportModule {}
