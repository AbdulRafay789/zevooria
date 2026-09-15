import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { resolveAssetsRoot, resolveSafeAssetPath } from '../../../lib/assets-path';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { path: pathSegments } = await context.params;

  try {
    const assetsRoot = resolveAssetsRoot();
    const absolutePath = resolveSafeAssetPath(assetsRoot, pathSegments);

    if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
      return new NextResponse('Not found', { status: 404 });
    }

    const ext = extname(absolutePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) {
      return new NextResponse('Unsupported media type', { status: 415 });
    }

    const stream = createReadStream(absolutePath);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
