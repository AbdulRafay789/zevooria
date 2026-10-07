Development Workflow
Golden rule

Build small, testable pieces.

Do not ask the Agent to build an entire domain in one task unless explicitly necessary.

Workflow
1. Read

Read:

AGENTS.md
applicable Cursor rules
relevant docs
roadmap
2. Inspect

Inspect the current implementation.

Search before creating new files.

3. Plan

Identify:

files to create
files to modify
database changes
API changes
tests
4. Implement

Make the smallest safe change.

5. Validate

Run:

tests
type checking
linting

as appropriate.

6. Review

Inspect git diff.

Remove unrelated changes.

7. Document

Update documentation when behavior or architecture changes.

8. Roadmap

Mark roadmap items complete only after validation.

Task sizing

Good:

Create Product entity.


Good:

Implement Product repository.


Good:

Add Product CRUD API.


Bad:

Build the complete e-commerce platform.

Refactoring

Refactoring should be separate from feature work.

Dependencies

Before adding a dependency, check whether an existing dependency solves the problem.

Database

Never edit an applied migration.

Production

Do not make production infrastructure changes as a side effect of application feature development.

Deploy (EC2 / Docker Compose)

1. Copy `.env.example` to untracked `.env` and set real `DB_*`, `ADMIN_SEED_*`, and `ADMIN_DEMO_STAFF_PASSWORD` (and payment secrets when enabled).
2. Ensure `assets/` is present on the host (or set `ZEVOORIA_ASSETS_PATH`).
3. Build and start:

```bash
docker compose -f compose.yaml up -d --build
```

4. Run migrations inside the API container (bootstrap admin users run as part of migrations):

```bash
docker compose -f compose.yaml exec api npm run migration:run:prod
```

5. Optional catalog seed (first environment only):

```bash
docker compose -f compose.yaml exec api npm run seed:prod
```

6. Smoke-check:

```bash
curl -sS http://localhost:3001/api/health
curl -sS http://localhost:3001/api/products | head
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3002/
```

Production notes (EC2)

- Repo-root `.env` must set real `DB_*` including `DB_SSL=true` and `DB_SSL_CA=/certs/rds/global-bundle.pem` for RDS.
- Do not set `EMAIL_LOG_BODY=true` in production.
- Customer email (verify + password reset + order confirmation): on EC2 set `EMAIL_PROVIDER=ses`, `AWS_REGION=ap-south-1`, and `MAIL_FROM=Zevooria <no-reply@zevooria.com>`. Credentials come from the **EC2 IAM instance role** (SES `SendEmail` / `SendRawEmail`) — do not create access keys or SMTP credentials for the app. Local default is `EMAIL_PROVIDER=console`. `WEB_PUBLIC_URL` must be set so emails include working links. Request SES production access when leaving sandbox.
- Support inbound (Phase 2): Nest `@Interval` poller every 60s reads SES→S3 objects from bucket `zevooria-support-inbound-516644465984-ap-south-1-an` prefix `incoming/` using the same IAM role / `AWS_REGION`. Polling defaults **off** when `EMAIL_PROVIDER=console` (local), **on** when `EMAIL_PROVIDER=ses` (EC2). Override with `SUPPORT_INBOUND_POLLING_ENABLED=true|false`. Optional: `SUPPORT_S3_BUCKET`, `SUPPORT_S3_INCOMING_PREFIX`, `SUPPORT_INBOUND_BATCH_SIZE`. Objects are not deleted after processing. Attachment bytes are uploaded to `support-attachments/` in the same bucket before the DB transaction commits (orphan S3 objects on TX failure are logged and acceptable for now).
- Support S3 IAM on `ZevooriaEC2Role` must allow **read** of `incoming/*` and **write** of `support-attachments/*` on that bucket. Without `s3:PutObject` on `support-attachments/*`, emails with attachments fail every poll (failed inbound keys are retried until they succeed). Example statements:

```json
{
  "Effect": "Allow",
  "Action": ["s3:ListBucket"],
  "Resource": "arn:aws:s3:::zevooria-support-inbound-516644465984-ap-south-1-an",
  "Condition": {
    "StringLike": { "s3:prefix": ["incoming/", "incoming/*"] }
  }
},
{
  "Effect": "Allow",
  "Action": ["s3:GetObject"],
  "Resource": "arn:aws:s3:::zevooria-support-inbound-516644465984-ap-south-1-an/incoming/*"
},
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:GetObject"],
  "Resource": "arn:aws:s3:::zevooria-support-inbound-516644465984-ap-south-1-an/support-attachments/*"
}
```

(`s3:GetObject` on `support-attachments/*` is also required for admin attachment presigned URLs.)
- Support admin API (Phase 3): `GET/PATCH /api/admin/support/conversations` with `support:read` / `support:update` (admin + store_admin by default).
- Support admin UI (Phase 4): `/support` list + `/support/:id` detail in the admin app (status/assignee updates; bodyText only — no HTML injection). Attachment View/Download uses short-lived S3 presigned URLs via `GET /api/admin/support/conversations/:conversationId/attachments/:attachmentId` (`support:read`).
- Support outbound replies (Phase 5): dedicated `SupportOutboundService` uses SES `SendRawEmail` (not transactional `CustomerEmailService`). From `Zevooria Support <support@zevooria.com>` (override `SUPPORT_MAIL_FROM` / `SUPPORT_FROM_EMAIL`). Plain-text only; no reply attachments. Threading via RFC `Message-ID` / `In-Reply-To` / `References`. Outbound MIME includes quoted prior conversation messages (classic `>` history) after the admin reply so the recipient sees thread context; the database stores only the admin’s unquoted `bodyText`. Column `ses_message_id` remains the RFC Message-ID for threading; `aws_ses_message_id` stores the SES API MessageId. Guest requesters (no customer row) can be replied to. Composer requires `support:update`.
- Rotate bootstrap admin passwords (`ADMIN_SEED_*` / demo staff) before public launch.
- Optional admin Web Push: set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (never commit real keys).
- Set `WEB_PUBLIC_URL` to the public storefront origin (no trailing slash), e.g. `https://zevooria.com`. Admin product-box QR codes encode `{WEB_PUBLIC_URL}/products/{slug}`. Local Compose defaults to `http://localhost:3000`.
- Set `ADMIN_PUBLIC_URL` to the public admin origin (no trailing slash), e.g. `https://admin.zevooria.com`. Required for API CORS allowlist in production.
- Host Nginx should proxy `admin.<domain>` → `127.0.0.1:3002` and storefront → `127.0.0.1:3000` with Let’s Encrypt. Admin product image previews use same-origin `/assets` (admin container mount); never `hostname:3000` over HTTPS.
- Product image uploads write into the shared `assets/` bind mount (`ASSETS_ROOT=/app/assets`). The API entrypoint chowns that mount to the `nestjs` user on start — rebuild the API image after pull so production uploads stop returning 500 on permission errors.
- Migrations are **not** auto-run on container start. After every deploy that may include schema changes: `docker compose exec api npm run migration:run:prod`.
- Do **not** run `seed:prod` on every deploy (first environment only).
- Do **not** run a second `docker compose build --no-cache` after a successful migrate — that doubles downtime and can race with migrations already applied.

Local development (instant hot reload)

Recommended day-to-day workflow — Postgres in Docker, apps on the host:

```bash
npm run dev
```

This single command:

1. Starts local Postgres
2. Stops Docker api/web/admin (frees ports 3000–3002)
3. Runs pending migrations against local Postgres
4. Starts API on **3001**, waits until healthy
5. Starts web on **3000** and admin on **3002** with hot reload

Edit source and refresh; no image rebuild.

Local Docker stack (prod-like QA — rebuild required after code changes)

```bash
npm run docker:local
npm run docker:local:migrate
```

Do not use `docker compose up` without `--build` after code changes — you will keep an old image. Do not bind `./apps/web:/app` over the container; that breaks Next standalone.

Stop Docker apps when switching back to `npm run dev` (the `dev` script does this automatically).

Production deploy (EC2)

Use `compose.yaml` only (never `compose.local.yaml` on the server).

**Before the first deploy that clears operational data:** take an **RDS snapshot**.

Your laptop `.env` may point at RDS. Do not run local reset against that file without overriding `DB_*` to localhost.

---

### Step A — Windows (pack + upload)

From PowerShell:

```powershell
cd D:\zevooria
.\scripts\windows-pack-upload.ps1
```

Or with explicit PEM/IP:

```powershell
.\scripts\windows-pack-upload.ps1 -PemPath "D:\pem file of ssh\prod.pem" -HostIp "13.235.37.96"
```

Equivalent manual commands:

```bat
cd D:\zevooria
tar --exclude=.git --exclude=node_modules --exclude=.next --exclude=dist --exclude=.env --exclude=compose.local.yaml --exclude=zevooria-deploy.tar.gz -czf zevooria-deploy.tar.gz .
scp -i "D:\pem file of ssh\prod.pem" .\zevooria-deploy.tar.gz ubuntu@13.235.37.96:/home/ubuntu/
ssh -i "D:\pem file of ssh\prod.pem" ubuntu@13.235.37.96
```

---

### Step B — Server (after SSH) — only this

```bash
cd /home/ubuntu
tar -xzf zevooria-deploy.tar.gz -O scripts/ec2-run-from-tarball.sh > /tmp/ec2-run-from-tarball.sh
bash /tmp/ec2-run-from-tarball.sh
```

That pulls [`scripts/ec2-server-deploy.sh`](../scripts/ec2-server-deploy.sh) and runs the full deploy:

1. Copy production `.env` + `assets/`  
2. Stop stack, swap dirs (`zevooria-prev-…`)  
3. Set `WEB_PUBLIC_URL` + `ADMIN_PUBLIC_URL`  
4. `docker compose up -d --build --force-recreate --remove-orphans` (no second `--no-cache` build)  
5. Health retry → `migration:run:prod`  
6. **One-time** operational DB reset **only if** `/home/ubuntu/.zevooria_operational_reset_done` is missing; then creates that sentinel so later deploys skip the wipe  
7. Smoke checks + logs  

**Do not** run afterward:

```bash
docker compose build --no-cache
docker compose up -d --force-recreate --remove-orphans
```

To force another wipe later (rare): delete `/home/ubuntu/.zevooria_operational_reset_done` after a new RDS snapshot, then redeploy.

---

### Local Docker Postgres operational reset (not RDS)

```powershell
$env:CONFIRM_OPERATIONAL_RESET='YES'
$env:DB_HOST='localhost'; $env:DB_PORT='5432'
$env:DB_USER='zevooria'; $env:DB_PASSWORD='zevooria'; $env:DB_NAME='zevooria'
$env:DB_SSL='false'
Remove-Item Env:DB_SSL_CA -ErrorAction SilentlyContinue
npm run reset:operational:dev -w @zevooria/api
```

Pre-deploy validation on your machine:

```bash
npm run validate
```
