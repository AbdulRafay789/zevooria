import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  auditRequestFromHeaders,
  clientIpFromRequest,
} from '../audit/audit.service';
import { AuthTokenService } from './auth-token.service';
import { AuthService } from './auth.service';
import { CustomerAddressService } from './customer-address.service';
import {
  AuthGuard,
  AuthenticatedRequest,
  extractBearerToken,
} from './auth.guard';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  RefreshSessionDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import {
  CustomerAddressDto,
  UpdateCustomerAddressDto,
} from './dto/customer-address.dto';
import { User } from './entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authTokenService: AuthTokenService,
    private readonly addressService: CustomerAddressService,
  ) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('logout')
  async logout(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: LogoutDto,
  ) {
    await this.authService.logout(
      extractBearerToken(headers),
      body?.refreshToken,
    );
    return { ok: true };
  }

  @Post('refresh')
  refresh(@Body() body: RefreshSessionDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Get('me')
  me(@Headers() headers: Record<string, string | string[] | undefined>) {
    return this.authService.me(extractBearerToken(headers));
  }

  @Get('addresses')
  @UseGuards(AuthGuard)
  listAddresses(@Req() req: Request & AuthenticatedRequest & { user: User }) {
    return this.addressService.listForCustomer(req.user.id);
  }

  @Post('addresses')
  @UseGuards(AuthGuard)
  createAddress(
    @Req() req: Request & AuthenticatedRequest & { user: User },
    @Body() body: CustomerAddressDto,
  ) {
    return this.addressService.create(req.user.id, body);
  }

  @Patch('addresses/:id')
  @UseGuards(AuthGuard)
  updateAddress(
    @Req() req: Request & AuthenticatedRequest & { user: User },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: UpdateCustomerAddressDto,
  ) {
    return this.addressService.update(req.user.id, id, body);
  }

  @Post('addresses/:id/default')
  @UseGuards(AuthGuard)
  setDefaultAddress(
    @Req() req: Request & AuthenticatedRequest & { user: User },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.addressService.setDefault(req.user.id, id);
  }

  @Delete('addresses/:id')
  @UseGuards(AuthGuard)
  async deleteAddress(
    @Req() req: Request & AuthenticatedRequest & { user: User },
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    await this.addressService.remove(req.user.id, id);
    return { ok: true };
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  updateProfile(
    @Req() req: Request & AuthenticatedRequest & { user: User },
    @Body() body: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(
      req.user.id,
      body,
      auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    );
  }

  @Post('deactivate')
  @UseGuards(AuthGuard)
  deactivate(@Req() req: Request & AuthenticatedRequest & { user: User }) {
    return this.authService.deactivateAccount(
      req.user.id,
      auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    );
  }

  @Post('delete-account')
  @UseGuards(AuthGuard)
  deleteAccount(@Req() req: Request & AuthenticatedRequest & { user: User }) {
    return this.authService.deleteAccount(
      req.user.id,
      auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    );
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  changePassword(
    @Req() req: Request & AuthenticatedRequest & { user: User },
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      req.user.id,
      body,
      auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    );
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authTokenService.requestCustomerPasswordReset(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto, @Req() req: Request) {
    return this.authTokenService.resetCustomerPassword(
      body,
      auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    );
  }

  @Post('request-email-verification')
  @UseGuards(AuthGuard)
  requestEmailVerification(@Req() req: AuthenticatedRequest & { user: User }) {
    return this.authTokenService.requestCustomerEmailVerification(req.user.id);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: VerifyEmailDto, @Req() req: Request) {
    return this.authTokenService.verifyCustomerEmail(
      body.token,
      auditRequestFromHeaders(req.headers, clientIpFromRequest(req)),
    );
  }
}
