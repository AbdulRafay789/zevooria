Security Requirements
Authentication

Use secure authentication mechanisms.

Passwords must be securely hashed (scrypt).

Password creation policy (register and change-password):

- minimum length: 8 characters
- at least 2 special characters (any character outside A–Z, a–z, and 0–9)

Login authenticates only and must not reject an existing account solely because its historical password does not meet the creation policy.

Authentication tokens/sessions must be protected.

Customer access tokens expire after **30 minutes**. A longer-lived **refresh token** (14 days) is stored hashed on the session row and used only via `POST /api/auth/refresh` to mint a new access token (refresh tokens rotate on use). Near access expiry the storefront prompts the customer to stay signed in or log out. Admin sessions expire after **30 minutes** (cookie + server session).

Browser session delivery (storefront + admin)

Session tokens must **not** be stored in `localStorage` or other JavaScript-readable storage (XSS risk). The Next.js `/backend` BFF proxies set **httpOnly** cookies (`zevooria_access` / `zevooria_refresh` on the storefront; `zevooria_admin_access` on admin), strip tokens from login/register/refresh responses, and inject `Authorization: Bearer` when forwarding to Nest. Clients keep only the user profile in memory and rehydrate via `/auth/me` or `/admin/auth/me`. Permission codes must never be treated as authoritative on the client — `PermissionsGuard` enforces them server-side. Admin SSE and QR sheet URLs must not pass tokens as query parameters.

Change password

Authenticated customers may change password via `POST /api/auth/change-password`.

Rules:

- current password must be verified
- new password must meet the creation policy above and match confirmation
- new password is stored only as a scrypt hash
- existing sessions for that customer are revoked
- a fresh session is established for the requesting client

Do not log passwords or password hashes.

Authorization

Every protected backend operation must enforce authorization.

Never rely solely on frontend role checks.

Order and review endpoints must authorize using the authenticated session user and UUID resource ownership checks.

Admin endpoints authorize using a separate admin session (`zevooria_admin_users` / `zevooria_admin_sessions`). Customer tokens must not grant admin access.

Staff RBAC uses `zevooria_admin_roles`, `zevooria_admin_permissions`, and join tables. Permission codes are enforced server-side via `PermissionsGuard`. The admin portal header and routes also hide/block screens the signed-in staff member does not have (deny-by-default). Seeded roles include `admin`, `store_admin`, `store_staff`, `sales`, `catalog`, and `store_user`. Legacy `role=admin` without assigned permission rows still receives full ops access as a migration bridge.

`notifications:read` controls the alerts bell and Notifications screen (separate from `orders:read`).

`support:read` / `support:update` control the admin support inbox API (list/detail/update conversations). Admin UI and outbound replies are not implemented yet.

Customers support soft deactivate (`is_active=false`) and soft delete (`deleted_at`). Admins with `customers:update` may restore a soft-deleted account (clears `deleted_at` and sets `is_active=true`). Inactive/deleted customers cannot authenticate until restored or reactivated.

Password reset and email verification tokens are stored only as hashes in `zevooria_auth_tokens`. Forgot-password responses must not reveal whether an email exists.

Local development: the console email provider logs message bodies (including one-time tokens) when `NODE_ENV` is not `production`, or when `EMAIL_LOG_BODY=true` (used by `compose.local.yaml`). Never set `EMAIL_LOG_BODY=true` in real production.

When `EMAIL_PROVIDER=ses`, the API uses Amazon SES API (`@aws-sdk/client-ses`) with the AWS SDK default credential provider chain (EC2 instance IAM role in production). Configure `AWS_REGION` (default `ap-south-1`) and `MAIL_FROM` (e.g. `Zevooria <no-reply@zevooria.com>`). Do not put AWS access keys in the app, `.env`, or Next.js. Local default is `EMAIL_PROVIDER=console` (stdout). SES/console providers never log email bodies containing tokens in production unless `EMAIL_LOG_BODY=true` (console only; never enable in real production).

Bootstrap admin users (ops + demo staff) are upserted by migration `BootstrapAdminUsers` using scrypt password hashes. Prefer setting `ADMIN_SEED_*` and `ADMIN_DEMO_STAFF_PASSWORD` in the untracked `.env` for production. Local Compose may supply bootstrap defaults — rotate all bootstrap passwords before any public launch. Never commit production secrets.

Input

Validate all external input.

Do not trust:

IDs
prices
quantities
payment states
permissions
filenames
uploaded file types
Payments

Payment callbacks must be verified.

Payment credentials must remain server-side.

S3

S3 access should follow least privilege.

Private assets should use controlled access mechanisms.

Secrets

Secrets must come from secure environment/configuration mechanisms.

Never commit secrets.

API

Use:

HTTPS
rate limiting
validation
secure headers
CORS restrictions
appropriate authentication controls

Rate limiting (soft-launch medium tier)

Per client IP, per 60-second window, differentiated by endpoint type:

| Bucket | Methods / paths | Limit |
| --- | --- | --- |
| read | GET, HEAD, OPTIONS | 100 / min |
| write | POST, PUT, PATCH, DELETE (non-auth) | 10 / min |
| auth | login, register, forgot/reset password, refresh (customer + admin) | 5 / min |

Exempt: `GET /api/health`, admin notification SSE streams.

Every throttled response includes:

- `X-RateLimit-Limit` — max requests in the window
- `X-RateLimit-Remaining` — remaining requests
- `X-RateLimit-Reset` — Unix timestamp when the window resets
- `Retry-After` — seconds (only when blocked; HTTP 429)

Tier guidance (not all implemented; medium is active):

- **Low** (tight / shared IP): read 60, write 5, auth 3
- **Medium** (soft launch, current): read 100, write 10, auth 5
- **High** (growth): read 300, write 30, auth 15

CORS

Browser origins are allowlisted from `WEB_PUBLIC_URL` and `ADMIN_PUBLIC_URL`. In non-production, when those are unset, localhost storefront/admin ports are allowed. Production with no origins configured rejects cross-origin browser calls.

Security headers

Helmet is enabled on the Nest API (CSP disabled for JSON API; CORP set to `cross-origin` so storefront/admin can load proxied assets).

Upload validation

Admin product image uploads accept JPEG, PNG, or WebP only (max 5MB). Type is detected from magic bytes — client MIME and filename are not trusted. GIF is rejected.
Logging

Do not log:

passwords
access tokens
payment credentials
private keys
unnecessary sensitive personal information
Audit

Important administrative and financial operations should be auditable.

MVP audit trail (`zevooria_audit_logs`) records actor type/id, action, optional resource, non-sensitive metadata, and request IP/user-agent when available. Failures writing audit rows must not break the business operation. Never store passwords, session tokens, or payment credentials in audit metadata.

Readable via `GET /api/admin/audit-logs` (`audit:read`).

Deployment

Production credentials must not be stored in the Git repository.
