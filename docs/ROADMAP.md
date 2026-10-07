E-Commerce Development Roadmap

Status:

[ ] Not started
[~] In progress
[x] Complete
[!] Blocked
[D] Deferred past soft-launch MVP

Active workstream (confirmed):

1. [x] Inventory reservations — place reserves; confirm/ship consumes; cancel releases or restores; no TTL
2. [x] Accounting reports — general ledger, P&L, balance sheet in admin (payment fees / reseller commissions stay deferred; refund accounting with returns)
3. [x] Server-backed guest + customer carts and login merge (Phase 8)
4. [x] Returns — admin-created; delivered only; line-level; restock after inspect; bank transfer via Refunds Payable then clear when paid; 14-day window from delivery (/returns); refund journals included

Phase 0 — Project Governance
 [x] Repository reviewed
 [x] AGENTS.md
 [x] Cursor rules
 [x] Project documentation
 [x] Architecture documentation
 [x] Database documentation
 [x] Accounting documentation
 [x] Payment documentation
 [x] Security documentation
 [x] Development workflow
Phase 1 — Infrastructure
 [x] AWS account
 [x] Billing alerts
 [x] EC2
 [x] Elastic IP
 [x] Docker
 [x] RDS PostgreSQL
 [ ] S3
 [x] Security groups
 [x] Nginx
 [x] HTTPS
 [x] DNS
 [x] Environment configuration
 [x] Health endpoint
Phase 2 — Monorepo
 [x] Workspace
 [x] API
 [x] Web
 [x] Admin
 [D] Reseller
 [D] Mobile
 [D] Shared types
 [D] Shared validation
 [D] API client
 [D] Shared config
Phase 3 — Authentication & Authorization
 [x] Users
 [x] Roles
 [x] Permissions
 [x] Registration
 [x] Login
 [x] Logout
 [x] Refresh (N/A — opaque sessions)
 [x] Password reset
 [x] Email verification
 [x] RBAC
 [x] Audit logging
Phase 4 — Customers
 [x] Customer profile
 [x] Addresses
 [x] Default address
 [x] Account settings
Phase 5 — Catalog
 [ ] Brands
 [ ] Categories
 [x] Products
 [D] Product variants
 [D] Sizes
 [D] Colors
 [D] SKU
 [x] Product images
 [x] Pricing
 [~] SEO
Phase 6 — Inventory
 [x] Warehouses
 [x] Stock
 [x] Stock movements
 [x] Reservations
 [x] Adjustments
 [x] Inventory audit
Phase 7 — Storefront
 [x] Homepage
 [~] Category
 [x] Search
 [x] Filters
 [x] Product listing
 [x] Product detail
 [x] Wishlist
 [x] Cart
 [x] Customer account
Phase 8 — Cart & Checkout
 [x] Guest cart
 [x] Customer cart
 [x] Cart merge
 [x] Quantity management
 [x] Stock validation
 [x] Price validation
 [x] Checkout
Phase 9 — Orders
 [x] Order creation
 [x] Order items
 [x] Statuses
 [x] Status history
 [x] Cancellation
 [x] Confirmation
Phase 10 — Shipping
 [D] Shipping methods
 [D] Shipping zones
 [x] Shipping rates
 [D] Shipments
 [D] Tracking
Phase 11 — Payment Architecture
 [~] Payment abstraction
 [D] Payment attempts
 [D] Transactions
 [D] Webhooks
 [~] Idempotency
 [D] Refund abstraction
Phase 12 — EasyPaisa
 [D] Credentials/configuration
 [D] Payment initiation
 [D] Verification
 [D] Callback/webhook
 [D] Failure handling
 [D] Duplicate handling
 [D] Reconciliation
Phase 13 — Bank Alfalah
 [D] Credentials/configuration
 [D] Payment initiation
 [D] Verification
 [D] Callback/webhook
 [D] Failure handling
 [D] Duplicate handling
 [D] Reconciliation
Phase 14 — Accounting
 [x] Account types
 [x] Chart of accounts
 [x] Fiscal periods
 [x] Journals
 [x] Journal entries
 [x] Journal lines
 [x] General ledger
 [x] Trial balance
 [x] Profit & loss
 [x] Balance sheet
 [x] Sales accounting
 [x] COGS
 [x] Inventory accounting
 [D] Payment fees
 [x] Refund accounting
 [D] Reseller commissions
Phase 15 — Returns & Refunds
 [x] Return requests
 [x] Return items
 [x] Approval
 [x] Refunds
 [x] Inventory restoration
 [x] Accounting reversal
Phase 16 — Promotions
 [x] Coupons (promo codes: percent / fixed PKR)
 [x] Promotions (MVP = promo codes applied at checkout)
 [D] Rules
 [x] Usage limits (global max uses)
 [x] Expiration
 [D] Customer restrictions
 [D] Reseller pricing
Phase 17 — Resellers
 [D] Registration
 [D] Approval
 [D] Profile
 [D] Pricing
 [D] Referral tracking
 [D] Commission calculation
 [D] Commission approval
 [D] Payouts
 [D] Dashboard
Phase 18 — Admin
 [x] Dashboard
 [x] Products
 [D] Categories
 [x] Inventory
 [x] Orders
 [x] Customers
 [D] Resellers
 [D] Payments
 [x] Accounting
 [x] Promotions
 [D] Shipping
 [D] CMS
 [x] Reports
 [x] Users
 [x] Roles
 [D] Settings
 [x] Audit logs
Phase 19 — CMS
 [D] Pages
 [D] Sections
 [D] Banners
 [D] Sliders
 [D] Menus
 [D] Footer
 [D] FAQ
 [D] Blog
 [D] Media
 [D] SEO
Phase 20 — Notifications
 [x] Notification abstraction
 [x] Email (console local + Amazon SES API via EMAIL_PROVIDER=ses / EC2 IAM role)
 [D] SMS abstraction
 [x] Push abstraction
 [x] Order notifications (admin in-app + customer order-placed email)
 [D] Payment notifications
 [x] Account notifications (customer welcome + verify + password-reset emails with branded HTML; storefront links)
 [D] Reseller notifications
 [D] Queue workers
Phase 20b — Support inbox
 [x] Schema (conversations, messages, attachments, inbound S3 object idempotency)
 [x] S3 inbound poller + MIME parsing (Nest schedule 60s; mailparser; IAM role; no object delete)
 [x] Admin API + RBAC (`support:read` / `support:update`; list/detail/update; reply)
 [x] Admin UI (list/detail; status + assignee; reply composer for `support:update`)
 [x] Outbound reply via SES SendRawEmail (plain text; guest requesters OK; threading)
 [ ] Admin notifications for new messages
Phase 21 — Ionic
 [D] Authentication
 [D] Home
 [D] Categories
 [D] Search
 [D] Product
 [D] Cart
 [D] Checkout
 [D] Orders
 [D] Wishlist
 [D] Account
 [D] Notifications
Phase 22 — Testing
 [x] Unit tests
 [~] Integration tests
 [~] API tests (supertest smoke with E2E_DB=true)
 [ ] E2E tests
 [D] Payment tests
 [~] Order tests
 [~] Inventory tests
 [x] Accounting tests
 [D] Reseller tests
 [x] Authentication tests
Phase 23 — Security
 [x] Rate limiting (method-aware + X-RateLimit-* headers)
 [x] Validation
 [x] Authorization
 [x] CORS (WEB_PUBLIC_URL / ADMIN_PUBLIC_URL allowlist)
 [x] Security headers (helmet)
 [x] Upload validation (magic-byte JPEG/PNG/WebP, 5MB)
 [D] S3 permissions
 [~] Secret management
 [x] Audit logs
 [D] Webhook verification
Phase 24 — Production
 [x] Production Docker
 [x] Nginx
 [x] HTTPS
 [D] CI/CD
 [ ] Database backups
 [ ] Backup restoration
 [ ] Logging
 [ ] Monitoring
 [D] Redis
 [D] Queue workers
Phase 25 — Launch
 [ ] Production smoke tests
 [D] Payment tests
 [D] Refund tests
 [ ] Inventory tests
 [D] Mobile tests
 [ ] Performance tests
 [~] SEO
 [ ] Error monitoring
 [ ] Security review
 [ ] Soft launch
 [ ] Production launch
