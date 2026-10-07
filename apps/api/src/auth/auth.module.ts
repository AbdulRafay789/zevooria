import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminUser } from '../admin/entities/admin-user.entity';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../notifications/mail.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { OptionalAuthGuard } from './optional-auth.guard';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { CustomerAddressService } from './customer-address.service';
import { AuthToken } from './entities/auth-token.entity';
import { CustomerAddress } from './entities/customer-address.entity';
import { Session } from './entities/session.entity';
import { User } from './entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Session,
      AuthToken,
      AdminUser,
      CustomerAddress,
    ]),
    AuditModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    OptionalAuthGuard,
    AuthTokenService,
    CustomerAddressService,
  ],
  exports: [
    AuthService,
    AuthGuard,
    OptionalAuthGuard,
    AuthTokenService,
    CustomerAddressService,
    TypeOrmModule,
  ],
})
export class AuthModule {}
