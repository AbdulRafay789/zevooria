import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerRequest } from '@nestjs/throttler';
import {
  isRateLimitExemptPath,
  resolveRateLimitForRequest,
} from './rate-limit';

/**
 * Method-aware throttle: high limit for reads, strict for writes/auth.
 * Sets standard X-RateLimit-* headers (Unix reset timestamp).
 */
@Injectable()
export class SoftLaunchThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const { req } = this.getRequestResponse(context);
    const path = String(req.path ?? req.url ?? '');
    return isRateLimitExemptPath(path);
  }

  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const { context, ttl, throttler, blockDuration, getTracker, generateKey } =
      requestProps;
    const { req, res } = this.getRequestResponse(context);
    const resolved = resolveRateLimitForRequest({
      method: String(req.method ?? 'GET'),
      pathOrUrl: String(req.path ?? req.url ?? ''),
    });
    const limit = resolved.limit;

    const tracker = await getTracker(req, context);
    const throttlerName = throttler.name ?? 'default';
    // Include bucket so read/write/auth counters stay independent per IP.
    const key = generateKey(
      context,
      `${tracker}:${resolved.bucket}`,
      throttlerName,
    );
    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storageService.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );

    const resetUnix =
      Math.ceil(Date.now() / 1000) +
      Math.max(1, Math.ceil(Number(timeToExpire) || ttl / 1000));

    if (isBlocked) {
      res.header('Retry-After', timeToBlockExpire);
      res.header('X-RateLimit-Limit', limit);
      res.header('X-RateLimit-Remaining', 0);
      res.header('X-RateLimit-Reset', resetUnix);
      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      });
    }

    res.header('X-RateLimit-Limit', limit);
    res.header('X-RateLimit-Remaining', Math.max(0, limit - totalHits));
    res.header('X-RateLimit-Reset', resetUnix);

    return true;
  }
}
