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
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

function parseByteRange(
  rangeHeader: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const spec = rangeHeader.slice('bytes='.length).split(',')[0]?.trim();
  if (!spec) {
    return null;
  }

  const [rawStart, rawEnd] = spec.split('-');
  let start = rawStart === '' ? Number.NaN : Number(rawStart);
  let end = rawEnd === '' || rawEnd === undefined ? size - 1 : Number(rawEnd);

  if (Number.isNaN(start)) {
    // suffix range: bytes=-500
    const suffix = Number(rawEnd);
    if (!Number.isFinite(suffix) || suffix <= 0) {
      return null;
    }
    start = Math.max(size - suffix, 0);
    end = size - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0) {
    return null;
  }

  end = Math.min(end, size - 1);
  if (start > end) {
    return null;
  }

  return { start, end };
}

export async function GET(request: NextRequest, context: RouteContext) {
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

    const { size } = statSync(absolutePath);
    const range = parseByteRange(request.headers.get('range'), size);
    const cacheControl =
      'public, max-age=86400, stale-while-revalidate=604800';

    if (range) {
      const { start, end } = range;
      const chunkSize = end - start + 1;
      const stream = createReadStream(absolutePath, { start, end });
      return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': cacheControl,
        },
      });
    }

    const stream = createReadStream(absolutePath);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': cacheControl,
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
