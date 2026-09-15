Database Design
Principles

PostgreSQL is the system of record.

All schema changes use migrations.

Financial and inventory data must be auditable.

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