import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthenticatedRequest } from './admin.guard';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminAuthService: AdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (required.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<AdminAuthenticatedRequest>();
    if (!request.admin) {
      throw new ForbiddenException('Insufficient permissions.');
    }

    const codes = await this.adminAuthService.getPermissionCodes(
      request.admin.id,
    );
    const missing = required.filter((code) => !codes.includes(code));
    if (missing.length > 0) {
      throw new ForbiddenException('Insufficient permissions.');
    }
    return true;
  }
}
