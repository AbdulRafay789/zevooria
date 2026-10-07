/**
 * Instant local development: Postgres in Docker, apps on the host with watch.
 *
 * Usage (from repo root):
 *   npm run dev
 *
 * Ports: web 3000, API 3001, admin 3002, Postgres 5432.
 * Runs pending migrations, then starts all apps.
 * Forces local DB env so a prod-pointing root `.env` cannot hijack the API.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const dockerCmd = 'docker';

const localDbEnv = {
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'zevooria',
  DB_PASSWORD: 'zevooria',
  DB_NAME: 'zevooria',
  DB_SSL: 'false',
  EMAIL_LOG_BODY: 'true',
  WEB_PUBLIC_URL: 'http://localhost:3000',
  ASSETS_ROOT: path.join(root, 'assets'),
  API_URL: 'http://localhost:3001',
};

function spawnInherit(command, args, env) {
  return spawn(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: isWin,
  });
}

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawnInherit(command, args, env);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`${command} ${args.join(' ')} exited with code ${code}`),
        );
      }
    });
  });
}

async function waitForPostgres(maxAttempts = 40) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await run(dockerCmd, [
        'compose',
        '-f',
        'compose.yaml',
        '-f',
        'compose.local.yaml',
        'exec',
        '-T',
        'postgres',
        'pg_isready',
        '-U',
        'zevooria',
        '-d',
        'zevooria',
      ]);
      return;
    } catch {
      if (attempt === maxAttempts) {
        throw new Error('Postgres did not become ready in time.');
      }
      await delay(1000);
    }
  }
}

async function waitForApi(maxAttempts = 60) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:3001/api/health');
      if (response.ok) {
        return;
      }
    } catch {
      // still booting
    }
    if (attempt === maxAttempts) {
      throw new Error(
        'API did not become ready on http://localhost:3001 — check the API logs above.',
      );
    }
    await delay(1000);
  }
}

async function main() {
  console.log('[dev] Starting local Postgres…');
  await run(dockerCmd, [
    'compose',
    '-f',
    'compose.yaml',
    '-f',
    'compose.local.yaml',
    'up',
    '-d',
    'postgres',
  ]);

  console.log('[dev] Waiting for Postgres…');
  await waitForPostgres();

  console.log(
    '[dev] Stopping Docker api/web/admin (frees ports 3000–3002 for host watch)…',
  );
  try {
    await run(dockerCmd, [
      'compose',
      '-f',
      'compose.yaml',
      '-f',
      'compose.local.yaml',
      'stop',
      'api',
      'web',
      'admin',
    ]);
  } catch {
    // Containers may not exist yet — fine.
  }

  const migrateEnv = {
    ...process.env,
    ...localDbEnv,
  };

  console.log('[dev] Running database migrations…');
  await run(
    npmCmd,
    ['run', 'migration:run:dev', '-w', '@zevooria/api'],
    migrateEnv,
  );

  const apiEnv = {
    ...process.env,
    ...localDbEnv,
    PORT: '3001',
  };
  // Next.js reads PORT — keep web on 3000 and admin on 3002 explicitly.
  const webEnv = {
    ...process.env,
    ...localDbEnv,
    PORT: '3000',
  };
  const adminEnv = {
    ...process.env,
    ...localDbEnv,
    PORT: '3002',
  };

  console.log('[dev] Starting API on :3001 (watch)…');
  const api = spawnInherit(
    npmCmd,
    ['run', 'start:dev', '-w', '@zevooria/api'],
    apiEnv,
  );

  console.log('[dev] Waiting for API health…');
  try {
    await waitForApi();
  } catch (err) {
    api.kill('SIGTERM');
    throw err;
  }

  console.log('[dev] Starting web on :3000 and admin on :3002…');
  const web = spawnInherit(
    npmCmd,
    ['run', 'dev', '-w', '@zevooria/web'],
    webEnv,
  );
  const admin = spawnInherit(
    npmCmd,
    ['run', 'dev', '-w', '@zevooria/admin'],
    adminEnv,
  );

  const children = [api, web, admin];
  console.log(
    '[dev] Ready → http://localhost:3000  |  http://localhost:3002  |  API :3001',
  );
  console.log('[dev] Edit source files — changes reload automatically.');

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    for (const child of children) {
      child.kill('SIGTERM');
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const codes = await Promise.all(
    children.map(
      (child) =>
        new Promise((resolve) => {
          child.on('exit', (code) => resolve(code ?? 1));
        }),
    ),
  );

  if (codes.some((code) => code !== 0) && !shuttingDown) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
