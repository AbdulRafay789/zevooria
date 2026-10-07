import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  auditRequestFromHeaders,
  clientIpFromRequest,
} from '../audit/audit.service';
import { extractBearerToken } from '../auth/auth.guard';
import { AuthTokenService } from '../auth/auth-token.service';
import { ForgotPasswordDto, ResetPasswordDto } from '../auth/dto/auth.dto';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from './admin.guard';
import { AdminLoginDto } from './dto/admin-auth.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Post('login')
  login(@Body() body: AdminLoginDto, @Req() req: Request) {
    return this.adminAuthService.login(
      body,
      auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    );
  }

  @Post('logout')
  async logout(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request,
  ) {
    await this.adminAuthService.logout(
      extractBearerToken(headers),
      auditRequestFromHeaders(headers, clientIpFromRequest(req)),
    );
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AdminGuard)
  me(@Headers() headers: Record<string, string | string[] | undefined>) {
    return this.adminAuthService.me(extractBearerToken(headers));
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authTokenService.requestAdminPasswordReset(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto, @Req() req: Request) {
    return this.authTokenService.resetAdminPassword(
      body,
      auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    );
  }
}
