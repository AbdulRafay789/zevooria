import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthenticatedRequest, extractBearerToken } from './auth.guard';

/**
 * Attaches `request.user` when a valid bearer token is present.
 * Does not reject anonymous requests (guest cart).
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers);
    if (!token) {
      return true;
    }
    const user = await this.authService.resolveUser(token);
    if (user) {
      request.user = user;
    }
    return true;
  }
}
