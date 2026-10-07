import { Global, Module } from '@nestjs/common';
import { CustomerEmailService } from './customer-email.service';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [MailService, CustomerEmailService],
  exports: [MailService, CustomerEmailService],
})
export class MailModule {}
