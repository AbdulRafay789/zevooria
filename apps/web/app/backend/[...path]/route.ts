import { NextRequest, NextResponse } from 'next/server';
import {
  WEB_ACCESS_COOKIE,
  WEB_ACCESS_MAX_AGE_SEC,
  WEB_REFRESH_COOKIE,
  WEB_REFRESH_MAX_AGE_SEC,
  extractAuthTokens,
  isWebAuthLogoutPath,
  isWebAuthRefreshPath,
  isWebAuthSessionPath,
  sessionCookieOptions,
} from '../../../lib/bff-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiBase(): string {
  return (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '');
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const target = `${getApiBase()}/${path.join('/')}${request.nextUrl.search}`;
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const authorization = request.headers.get('authorization');
  const accept = request.headers.get('accept');
  const idempotency = request.headers.get('idempotency-key');
  if (contentType) headers.set('content-type', contentType);
  if (accept) headers.set('accept', accept);
  if (idempotency) headers.set('idempotency-key', idempotency);

  const access = request.cookies.get(WEB_ACCESS_COOKIE)?.value;
  if (authorization) {
    headers.set('authorization', authorization);
  } else if (access) {
    headers.set('authorization', `Bearer ${access}`);
  }

  let bodyBuffer: ArrayBuffer | undefined;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    bodyBuffer = await request.arrayBuffer();
  }

  // Inject refresh token from httpOnly cookie when the client omits it.
  if (
    isWebAuthRefreshPath(path) &&
    request.method === 'POST' &&
    bodyBuffer &&
    bodyBuffer.byteLength > 0
  ) {
    try {
      const parsed = JSON.parse(
        Buffer.from(bodyBuffer).toString('utf8'),
      ) as Record<string, unknown>;
      if (!parsed.refreshToken) {
        const refresh = request.cookies.get(WEB_REFRESH_COOKIE)?.value;
        if (refresh) {
          parsed.refreshToken = refresh;
          const encoded = Buffer.from(JSON.stringify(parsed), 'utf8');
          bodyBuffer = encoded.buffer.slice(
            encoded.byteOffset,
            encoded.byteOffset + encoded.byteLength,
          );
          headers.set('content-type', 'application/json');
        }
      }
    } catch {
      // leave body as-is
    }
  } else if (
    isWebAuthRefreshPath(path) &&
    request.method === 'POST' &&
    (!bodyBuffer || bodyBuffer.byteLength === 0)
  ) {
    const refresh = request.cookies.get(WEB_REFRESH_COOKIE)?.value;
    if (refresh) {
      const encoded = Buffer.from(
        JSON.stringify({ refreshToken: refresh }),
        'utf8',
      );
      bodyBuffer = encoded.buffer.slice(
        encoded.byteOffset,
        encoded.byteOffset + encoded.byteLength,
      );
      headers.set('content-type', 'application/json');
    }
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
  };
  if (bodyBuffer) {
    init.body = bodyBuffer;
  }

  const upstream = await fetch(target, init);

  if (isWebAuthLogoutPath(path)) {
    const response = new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/json',
      },
    });
    response.cookies.set(WEB_ACCESS_COOKIE, '', {
      ...sessionCookieOptions(0),
      maxAge: 0,
    });
    response.cookies.set(WEB_REFRESH_COOKIE, '', {
      ...sessionCookieOptions(0),
      maxAge: 0,
    });
    return response;
  }

  if (isWebAuthSessionPath(path) && upstream.ok) {
    const rawText = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(rawText) as unknown;
    } catch {
      return new NextResponse(rawText, {
        status: upstream.status,
        headers: {
          'content-type':
            upstream.headers.get('content-type') ?? 'application/json',
        },
      });
    }
    const extracted = extractAuthTokens(data);
    if (!extracted) {
      return NextResponse.json(data, { status: upstream.status });
    }
    const response = NextResponse.json(extracted.body, {
      status: upstream.status,
    });
    const accessMaxAge =
      typeof extracted.expiresIn === 'number' && extracted.expiresIn > 0
        ? extracted.expiresIn
        : WEB_ACCESS_MAX_AGE_SEC;
    response.cookies.set(
      WEB_ACCESS_COOKIE,
      extracted.token,
      sessionCookieOptions(accessMaxAge),
    );
    response.cookies.set(
      WEB_REFRESH_COOKIE,
      extracted.refreshToken,
      sessionCookieOptions(WEB_REFRESH_MAX_AGE_SEC),
    );
    return response;
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get('content-type');
  if (upstreamType) {
    responseHeaders.set('content-type', upstreamType);
  }
  // Forward rate-limit headers when present.
  for (const name of [
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
    'retry-after',
  ]) {
    const value = upstream.headers.get(name);
    if (value) {
      responseHeaders.set(name, value);
    }
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}
