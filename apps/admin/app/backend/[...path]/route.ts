import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_ACCESS_MAX_AGE_SEC,
  extractAdminAuthToken,
  isAdminAuthLoginPath,
  isAdminAuthLogoutPath,
  isAdminSsePath,
  sessionCookieOptions,
} from '../../../lib/bff-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getApiBase(): string {
  return (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, '');
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  // Strip access_token from query so tokens never appear in URLs/logs.
  const searchParams = new URLSearchParams(request.nextUrl.search);
  searchParams.delete('access_token');
  const search = searchParams.toString();
  const target = `${getApiBase()}/${path.join('/')}${search ? `?${search}` : ''}`;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const authorization = request.headers.get('authorization');
  const accept = request.headers.get('accept');
  if (contentType) headers.set('content-type', contentType);
  if (accept) headers.set('accept', accept);

  const access = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  if (authorization) {
    headers.set('authorization', authorization);
  } else if (access) {
    headers.set('authorization', `Bearer ${access}`);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);

  if (isAdminAuthLogoutPath(path)) {
    const response = new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') ?? 'application/json',
      },
    });
    response.cookies.set(ADMIN_ACCESS_COOKIE, '', {
      ...sessionCookieOptions(0),
      maxAge: 0,
    });
    return response;
  }

  if (isAdminAuthLoginPath(path) && upstream.ok) {
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
    const extracted = extractAdminAuthToken(data);
    if (!extracted) {
      return NextResponse.json(data, { status: upstream.status });
    }
    const response = NextResponse.json(extracted.body, {
      status: upstream.status,
    });
    response.cookies.set(
      ADMIN_ACCESS_COOKIE,
      extracted.token,
      sessionCookieOptions(ADMIN_ACCESS_MAX_AGE_SEC),
    );
    return response;
  }

  const responseHeaders = new Headers();
  const upstreamType = upstream.headers.get('content-type');
  if (upstreamType) {
    responseHeaders.set('content-type', upstreamType);
  }
  if (isAdminSsePath(path)) {
    responseHeaders.set('cache-control', 'no-cache, no-transform');
    responseHeaders.set('connection', 'keep-alive');
    responseHeaders.set('x-accel-buffering', 'no');
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

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
