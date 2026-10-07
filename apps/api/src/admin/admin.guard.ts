import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { extractBearerToken } from '../auth/auth.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminUser } from './entities/admin-user.entity';

export type AdminAuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  admin?: AdminUser;
};

function extractAdminToken(
  request: AdminAuthenticatedRequest,
): string | undefined {
  // Prefer Authorization; admin BFF injects Bearer from httpOnly cookie.
  // Query access_token is no longer accepted (tokens must not appear in URLs).
  return extractBearerToken(request.headers);
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AdminAuthenticatedRequest>();
    const token = extractAdminToken(request);
    const admin = await this.adminAuthService.resolveAdmin(token);
    if (!admin) {
      throw new UnauthorizedException('Authentication required.');
    }
    request.admin = admin;
    return true;
  }
}
