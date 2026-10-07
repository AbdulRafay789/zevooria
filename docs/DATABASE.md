Database Design
Principles

PostgreSQL is the system of record.

All schema changes use migrations.

Financial and inventory data must be auditable.

Identifier convention

Application entities use UUID primary keys (`uuid`, `gen_random_uuid()`).

Customer-facing APIs and URLs use UUID identifiers (for example `/account/orders/<uuid>`).

Human-readable business references (for example order number `ZEV-…`) remain for display and support — they are not sequential database IDs.

Do not expose sequential numeric IDs through customer-facing APIs or URLs.

Product catalog pages may continue to use public slugs (`/products/<slug>`) while the product primary key remains a UUID.

Table naming convention

Zevooria domain tables use the `zevooria_` prefix.

Current commerce/catalog tables:

- `zevooria_customers` (customer accounts; TypeORM entity `User`; `is_active`, `deleted_at` soft lifecycle)
- `zevooria_sessions`
- `zevooria_admin_users` (staff accounts; separate from customers)
- `zevooria_admin_sessions`
- `zevooria_admin_roles`
- `zevooria_admin_permissions`
- `zevooria_admin_role_permissions`
- `zevooria_admin_user_roles`
- `zevooria_auth_tokens` (hashed password-reset / email-verify tokens)
- `zevooria_audit_logs` (admin/auth-sensitive audit trail; no secrets in metadata)
- `zevooria_customer_addresses` (saved customer shipping addresses; one default per customer)
- `zevooria_products`
- `zevooria_product_media`
- `zevooria_warehouses`
- `zevooria_inventory` (per warehouse/product on-hand + reserved)
- `zevooria_inventory_movements` (receipt/sale/adjustment/reservation/release)
- `zevooria_orders`
- `zevooria_order_items`
- `zevooria_order_addresses`
- `zevooria_order_status_history` (from/to status, actor, timestamps)
- `zevooria_payments`
- `zevooria_reviews`
- `zevooria_accounts` (chart of accounts)
- `zevooria_fiscal_periods`
- `zevooria_journal_entries` (immutable; idempotent on source_type + source_id + event_kind)
- `zevooria_journal_lines`
- `zevooria_admin_notifications`
- `zevooria_admin_notification_receipts`
- `zevooria_admin_push_subscriptions`
- `zevooria_admin_notification_preferences`
- `zevooria_promo_codes` (percent or fixed PKR; min subtotal; optional max uses and date window)
- `zevooria_carts` (one per customer user_id **or** anonymous guest_key)
- `zevooria_cart_items` (product + quantity 1–20 per cart)
- `zevooria_returns` (admin-created; statuses pending_inspect / inspected / refunded / cancelled)
- `zevooria_return_items` (line-level qty + line_refund snapshot)
- `zevooria_support_conversations` (support inbox threads; status open/pending/closed; optional `customer_id`; guest requester email allowed)
- `zevooria_support_messages` (inbound/outbound; `ses_message_id` = RFC Message-ID for threading; optional `aws_ses_message_id` = SES API MessageId for outbound; reply headers; optional `admin_user_id` for outbound)
- `zevooria_support_attachments` (message attachments; `storage_key` for S3 object keys)
- `zevooria_support_inbound_objects` (idempotency for SES→S3 raw objects; unique `s3_key`; status processed/failed)

Support inbox (Phase 1 schema only):

- Conversations may exist without a linked customer (guest email).
- Inbound object rows prevent double-processing of the same S3 key.
- Inbound poller (Phase 2) lists `incoming/` in the support S3 bucket, parses MIME with mailparser, and writes conversations/messages/attachments; `s3_key` idempotency prevents duplicates.
- Admin API (Phase 3+): `support:read` / `support:update`; list/detail/update, attachment access, and outbound reply endpoints.

Returns (COD):

- Only for `delivered` orders within **14 days** of the delivery status history timestamp.
- Admin creates the return (line-level quantities). Shipping is never refunded; merchandise refund is discount-aware.
- Inspect → restock on-hand (`return_restock` movement) + journals: Dr Sales / Cr Refunds Payable; Dr Inventory / Cr COGS.
- Mark refund paid → Dr Refunds Payable / Cr Bank.

Product `price` is the sell price (whole PKR). Optional `compare_at_price` is display-only for strikethrough when greater than `price`. `sort_order` controls storefront grid order (lower first). Product `cost` is whole PKR unit cost used for COGS on order confirm. Orders store `discount_amount`, optional `promo_code_id` / `promo_code` snapshot; `total = subtotal - discount_amount + shipping_amount`. Shipping is computed server-side (Karachi 250 / other cities 500).

Inventory reservations (COD):

- Place order → `reservation` movement; `quantity_reserved` increases; on-hand unchanged. Available = on-hand − reserved.
- Confirm (`processing`) or ship (if processing skipped) → consume reservation: reserved ↓ and on-hand ↓ with a `sale` movement.
- Cancel while reserved → `release` movement; reserved ↓ only.
- Cancel after sale (legacy place-consume or post-confirm) → restore on-hand (`order_cancel` receipt). No reservation TTL in this pass.

New domain tables must follow this prefix. Do not introduce generic names such as `users`, `orders`, or `reviews` for new Zevooria tables.

Logical documentation domains below may still use unprefixed conceptual names; physical PostgreSQL table names for implemented MVP commerce/catalog tables are Zevooria-prefixed as listed above.

Review ownership

A customer may review a product only when:

- they are authenticated
- the product appears on an order belonging to that customer
- the order status is `placed`

Uniqueness: one review per customer + product (`UQ_zevooria_reviews_user_product`).

There is no moderation/publication column in the current MVP. Submitted reviews may appear on the public homepage via `GET /api/reviews/public` using a first-name-only display name.

Main domains
Identity
users
roles
permissions
role_permissions
sessions
audit_logs

Customer
customers
customer_addresses

Catalog
brands
categories
products
product_variants
product_images
product_attributes
product_attribute_values

Inventory
warehouses
inventory
inventory_movements
inventory_reservations
inventory_adjustments

Commerce
carts
cart_items
orders
order_items
order_addresses
order_status_history
reviews

Shipping
shipping_methods
shipping_zones
shipping_rates
shipments
tracking_events

Payments
payments
payment_attempts
payment_transactions
payment_webhooks
refunds

Accounting
accounts
account_types
fiscal_periods
journals
journal_entries
journal_entry_lines

Resellers
resellers
reseller_tiers
reseller_prices
reseller_commissions
reseller_payouts
referrals

Promotions
coupons
promotions
promotion_rules
promotion_usages

CMS
pages
page_sections
banners
sliders
menus
faqs
blog_posts
media
seo_metadata

Money

Money must use decimal-safe database types.

Never use floating-point columns for financial values.

Auditability

Important business events should retain:

who performed the action
when it happened
what changed
relevant reference ID
Migrations

Never modify an already-applied migration.

Create a new migration for schema changes.
