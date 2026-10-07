API Standards
Base URL

Production hostname is not assigned yet.

The following value is a documentation placeholder only. It is not the live Zevooria API URL and must not be used to create DNS records or certificates:

https://api.example.com

Development:

http://localhost:<port>

API principles

The API is the authoritative business layer.

Clients must not bypass business rules.

Rate limiting

Soft-launch medium tier (per IP, 60s window): GET/HEAD/OPTIONS 100/min; POST/PUT/PATCH/DELETE 10/min; auth login/register/forgot/reset/refresh 5/min. Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` (Unix). Health and notification streams are exempt. See `docs/SECURITY.md`.

Authentication

Protected endpoints require authentication.

Authorization is checked server-side.

Customer identity for account/order/review operations is derived from the session — never from a client-supplied `userId`.

Storefront and admin browsers call the API through same-origin `/backend` BFF proxies, which keep session tokens in **httpOnly** cookies and inject `Authorization: Bearer` upstream. Direct API clients may still send Bearer headers. Do not put access or refresh tokens in `localStorage`.

UUID path parameters

Endpoints that accept entity identifiers in the path validate UUID format (typically UUID v4). Invalid values return 400 without querying arbitrary malformed IDs.

Current customer commerce endpoints (MVP)

Auth

- `POST /api/auth/register` (password creation policy: min 8 characters and at least 2 special characters outside A–Z/a–z/0–9)
- `POST /api/auth/login` (authenticates only; does not enforce creation policy on existing passwords; returns `token`, `refreshToken`, `expiresIn` (1800), `expiresAt`, `user`)
- `POST /api/auth/refresh` (body `{ refreshToken }`; rotates access + refresh; 401 if refresh expired)
- `POST /api/auth/logout` (revokes access session; optional body `{ refreshToken }` also clears by refresh hash)
- `GET /api/auth/me` (returns customer profile plus `expiresAt` for the current access session)
- `POST /api/auth/change-password` (authenticated; verifies current password; new password must meet creation policy; re-hashes with scrypt; revokes other sessions and returns a fresh session token)
- `POST /api/auth/forgot-password` (always `{ ok: true }`; issues hashed reset token when the email exists; email includes storefront link `${WEB_PUBLIC_URL}/reset-password?token=...` plus raw token fallback; via Nest `MailService` / `EmailProvider` — `EMAIL_PROVIDER=ses` uses Amazon SES API with the EC2 IAM role; default/local is console; local Compose may log the token body when `EMAIL_LOG_BODY=true`)
- `POST /api/auth/reset-password` (consumes one-time token; enforces creation policy)
- `POST /api/auth/request-email-verification` (authenticated; issues verify token; email includes `${WEB_PUBLIC_URL}/verify-email?token=...`)
- `POST /api/auth/verify-email` (consumes verify token; sets `emailVerifiedAt`)
- Register (`POST /api/auth/register`) auto-sends a branded welcome email and requests email verification (failures do not fail registration)
- `PATCH /api/auth/profile` (authenticated; update fullName + phone)
- `GET /api/auth/addresses` (authenticated; saved address book)
- `POST /api/auth/addresses` (authenticated; create; first address or `isDefault` becomes default)
- `PATCH /api/auth/addresses/:id` (authenticated; owner only)
- `POST /api/auth/addresses/:id/default` (authenticated; set default)
- `DELETE /api/auth/addresses/:id` (authenticated; owner only; promotes another default when needed)
- `POST /api/auth/deactivate` (authenticated; soft-deactivate; revoke sessions)
- `POST /api/auth/delete-account` (authenticated; soft-delete; revoke sessions; irreversible via normal UI)

Inactive or deleted customers cannot log in or complete password reset until an admin reactivates or restores the account. Registering again with the same email returns a conflict explaining that the account must be restored.

Admin auth (staff; separate from customers)

- `POST /api/admin/auth/login` (authenticates only; does not enforce creation policy on existing passwords; returns permission codes)
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/me` (admin session required)
- `POST /api/admin/auth/forgot-password`
- `POST /api/admin/auth/reset-password`

Admin ops (admin session + permission codes required)

- `GET /api/admin/dashboard` (`dashboard:read`; optional `?from=YYYY-MM-DD&to=YYYY-MM-DD&status=`; returns filtered order counts/revenue plus chart-of-accounts profit & loss totals for the date window)
- `GET /api/admin/reports` (`dashboard:read`; orders/revenue/top products summary)
- `GET /api/admin/orders` (`orders:read`)
- `GET /api/admin/orders/:id` (`orders:read`; includes `allowedNextStatuses`)
- `PATCH /api/admin/orders/:id/status` (`orders:update`; server-enforced transitions)
- `DELETE /api/admin/orders/:id` (`orders:update`; voids/cancels from any non-cancelled status including delivered; restores inventory and reverses journals)
- `GET /api/admin/customers` (`customers:read`)
- `GET /api/admin/customers/:id` (`customers:read`)
- `PATCH /api/admin/customers/:id/status` (`customers:update`; activate/deactivate; when deleted, `isActive: true` restores the account)
- `POST /api/admin/customers/:id/delete` (`customers:delete`; soft-delete)
- `GET /api/admin/products` (`products:read`)
- `POST /api/admin/products` (`products:update`; create product with name, optional slug, description, status, price, optional compareAtPrice, optional cost)
- `PATCH /api/admin/products/reorder` (`products:update`; body `{ productIds: uuid[] }` — sets storefront grid order)
- `GET /api/admin/products/:id` (`products:read`)
- `GET /api/admin/products/:id/qr` (`products:read`; metadata + storefront PDP URL from `WEB_PUBLIC_URL`)
- `GET /api/admin/products/:id/qr.png` (`products:read`; PNG download; optional `?size=`; encodes `{WEB_PUBLIC_URL}/products/{slug}`)
- `GET /api/admin/products/:id/qr-sheet` (`products:read`; printable HTML sheet; optional `?copies=`; auth via Bearer / admin BFF httpOnly cookie — not query tokens)
- `PATCH /api/admin/products/:id` (`products:update`; status and/or whole-PKR `price`/`compareAtPrice`/`cost` and/or description; status includes `archived`)
- `DELETE /api/admin/products/:id` (`products:update`; soft-delete → `archived`; hidden from storefront)
- `POST /api/admin/products/:id/media` (`products:update`; multipart `file`; JPEG/PNG/WebP only via magic-byte sniff; max 5MB; optional `altText`, `isPrimary`)
- `DELETE /api/admin/products/:id/media/:mediaId` (`products:update`; remove one product image; promotes next image to primary when needed)
- `GET /api/admin/promo-codes` (`promotions:read`)
- `POST /api/admin/promo-codes` (`promotions:update`)
- `PATCH /api/admin/promo-codes/:id` (`promotions:update`; type/value/min/max uses/dates/active)
- `DELETE /api/admin/promo-codes/:id` (`promotions:update`; removes code; order snapshots keep `promo_code` text via FK SET NULL)
- `GET /api/admin/inventory` (`inventory:read`; default warehouse stock per product)
- `GET /api/admin/inventory/movements` (`inventory:read`; optional `?limit=`)
- `PATCH /api/admin/inventory/:productId` (`inventory:update`; set `quantityOnHand`, optional `note`)
- `GET /api/admin/accounting/accounts` (`accounting:read`)
- `GET /api/admin/accounting/journal-entries` (`accounting:read`; optional `?limit=`)
- `GET /api/admin/accounting/trial-balance` (`accounting:read`)
- `GET /api/admin/accounting/general-ledger` (`accounting:read`; optional `?accountCode=&from=&to=&limit=`)
- `GET /api/admin/accounting/profit-and-loss` (`accounting:read`; optional `?from=&to=` entry dates)
- `GET /api/admin/accounting/balance-sheet` (`accounting:read`; optional `?asOf=` entry date)
- `GET /api/admin/returns` (`returns:read`)
- `GET /api/admin/returns/:id` (`returns:read`)
- `POST /api/admin/returns` (`returns:update`; body `{ orderId, reason?, items: [{ orderItemId, quantity }] }` — delivered only, ≤14 days from delivery)
- `POST /api/admin/returns/:id/inspect` (`returns:update`; restock + Sales/Refunds Payable/COGS journals)
- `POST /api/admin/returns/:id/mark-refunded` (`returns:update`; Refunds Payable → Bank)
- `GET /api/admin/support/conversations` (`support:read`; query `page`, `limit`≤100, optional `status=open|pending|closed`, optional `search` on requester email/name/subject; returns `{ items, page, limit, total, totalPages }`; ordered by `lastMessageAt DESC`; admin UI at `/support`)
- `GET /api/admin/support/conversations/:id` (`support:read`; conversation + safe customer/assignee summaries + messages ASC with attachment metadata only — no bytes/signed URLs; admin UI at `/support/:id`)
- `GET /api/admin/support/conversations/:conversationId/attachments/:attachmentId` (`support:read`; short-lived S3 presigned GET URL ~5 minutes + safe metadata; IDOR-safe; never accepts a client storage key)
- `PATCH /api/admin/support/conversations/:id` (`support:update`; body `{ status?, assigneeAdminId? }` — `assigneeAdminId` null clears assignee; audits `support.status_update` / `support.assignment_update`)
- `POST /api/admin/support/conversations/:id/reply` (`support:update`; body `{ bodyText }`; plain-text reply from `Zevooria Support <support@zevooria.com>` to `requesterEmail` — works for guests without a customer record; SES `SendRawEmail` with RFC threading; outbound MIME appends quoted prior messages for inbox history while the API/DB store only the admin’s reply text; sets status `pending`; audits `support.reply`)
- `GET /api/admin/notifications` (`notifications:read`; list + unread count)
- `GET /api/admin/notifications/stream` (`notifications:read`; SSE; auth via Bearer injected by admin BFF from httpOnly cookie)
- `GET /api/admin/notifications/vapid-public-key` (`notifications:read`)
- `GET|PATCH /api/admin/notifications/preferences` (`notifications:read`; `orderPlaced`, `pushEnabled`)
- `PATCH /api/admin/notifications/:id/read` (`notifications:read`)
- `POST /api/admin/notifications/read-all` (`notifications:read`)
- `POST|DELETE /api/admin/notifications/push-subscribe` (`notifications:read`; Web Push subscription)
- `GET /api/admin/audit-logs` (`audit:read`; paginated audit events for every actor, newest first; optional `?limit=` / `?offset=`; returns `{ items, total, limit, offset }` with `actorName` / `actorEmail` resolved when known)
- `GET /api/admin/permissions` (`admins:manage`; permission catalog)
- `GET /api/admin/roles` (`admins:manage`)
- `POST /api/admin/roles` (`admins:manage`)
- `PATCH /api/admin/roles/:id` (`admins:manage`; name and/or permissionCodes)
- `GET /api/admin/staff` (`admins:manage`)
- `POST /api/admin/staff` (`admins:manage`)
- `PATCH /api/admin/staff/:id` (`admins:manage`; name/active/password/roleIds)

Customer orders must not accept admin session tokens, and admin endpoints must not accept customer session tokens.

Orders

- `GET /api/cart` (optional auth; guest carts use `X-Cart-Guest-Key` UUID header)
- `PUT /api/cart/items` (body `{ productId, quantity }`; quantity `0` removes; optional auth / guest key)
- `DELETE /api/cart/items/:productId`
- `POST /api/cart/clear`
- `POST /api/cart/merge` (authenticated; body `{ guestKey }`; merges guest into user cart, deletes guest cart)

- `POST /api/orders` (COD create; authoritative pricing + shipping: Karachi 250 PKR, other cities 500 PKR; optional `promoCode` discounts merchandise only; validates and **reserves** inventory in the same transaction; writes initial status history; notifies admins in-app; emails the customer an order-received confirmation — email failures do not fail placement). Detail response includes `subtotal` / `discountAmount` / `promoCode` / `shippingAmount` / `total` plus aliases `totalExclusiveAmount` / `totalCharges` / `totalNetAmount`.
- `GET /api/orders` (authenticated customer’s orders only)
- `GET /api/orders/:id` (UUID; owner-protected; includes `statusHistory` + `canCancel`; same amount aliases as create)
- `POST /api/orders/:id/cancel` (owner-only; only while status is `placed`; **releases reservation** or restores on-hand for legacy consume-at-place orders; reverses posted journals if any; writes history)
- `GET /api/orders/:orderId/review-products` (UUID; owner-protected eligibility list with submitted review content when present)
- `POST /api/promo-codes/validate` (body `{ code, subtotalPkr }`; returns discount amount for merchandise only; case-insensitive)

Admin order detail (`GET /api/admin/orders/:id`) includes `statusHistory`. Cancelling via admin status update **releases reservation** (if still held) or restores on-hand (if already consumed) and reverses accounting journals. Admin `DELETE /api/admin/orders/:id` voids the order the same way from any non-cancelled status (including `delivered`), marks successful payments `REFUNDED`, and records status history. Moving an order to `processing` (or `shipped` if processing is skipped) **consumes the reservation** (↓ reserved, ↓ on-hand) and posts AR/Sales/COGS; `delivered` posts Cash/AR.

Catalog

- `GET /api/products` / `GET /api/products/:slug` include `availableQuantity`, `compareAtPrice` (nullable display list price), and `sortOrder` (storefront grid order) from the default warehouse (on-hand minus reserved). Storefront sellable quantity is **0 when available is below 10** (out of stock); admin inventory still shows true on-hand/reserved. Checkout reservations use the same minimum.

Reviews

- `GET /api/reviews/public?limit=&offset=`  
  Public homepage notes in batches (default/max `limit` **20**). Response: `{ items, total, averageRating, limit, offset, hasMore }`.  
  Each item: rating, review text, product name, safe first-name display, optional product image key.  
  `total` / `averageRating` cover all reviews; `items` is the current page only.  
  No moderation column exists yet — submitted reviews are eligible for public display. Does not expose email, phone, addresses, or internal IDs.
- `POST /api/reviews`
  Body: `orderId` (UUID), `productId` (UUID), `rating` (1–5), `body` (trimmed text).  
  Server verifies session customer → owned order → purchased product → no duplicate customer/product review. Writes `review.create` to the audit log.

Validation

All external input must be validated.

Use DTOs and validation.

Pagination

Collection endpoints should support a consistent pagination strategy.

Example:

?page=1&limit=20

Filtering

Use consistent filtering conventions.

Sorting

Use explicit supported sort fields.

Never allow arbitrary SQL/order expressions from users.

Errors

Use a consistent error structure.

Do not expose internal stack traces in production.

API versioning

API versioning should be introduced if breaking changes become necessary.

Documentation

New public API endpoints should be documented.

Shared types should be updated when API contracts change.
