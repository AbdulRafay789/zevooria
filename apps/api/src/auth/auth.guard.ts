import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

export type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: User;
};

export function extractBearerToken(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw = headers.authorization ?? headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value?.startsWith('Bearer ')) {
    return undefined;
  }
  const token = value.slice('Bearer '.length).trim();
  return token.length > 0 ? token : undefined;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers);
    const user = await this.authService.resolveUser(token);
    if (!user) {
      throw new UnauthorizedException('Authentication required.');
    }
    request.user = user;
    return true;
  }
}
