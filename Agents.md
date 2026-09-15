AI Agent Instructions
Project

This repository contains a production-grade multi-channel perfumes e-commerce platform.

The platform includes:

Next.js customer storefront
Next.js admin portal
Next.js reseller portal
Ionic mobile application
NestJS backend API
PostgreSQL
AWS infrastructure
AWS S3
AWS Route 53
Docker
Nginx
EasyPaisa payment integration
Bank Alfalah payment integration
Double-entry accounting
Inventory management
Reseller management
CMS
Notifications
Reporting

Initial infrastructure is EC2, Docker, Nginx, RDS PostgreSQL, S3, and Route 53.

Do not treat Redis, queues, CloudFront, WAF, load balancers, multiple API instances, database replicas, ECS, Kubernetes, or microservices as required initial infrastructure. Introduce them later only when required.

1. Mandatory reading before every change

Before changing ANY code:

Read this AGENTS.md.
Read the applicable .cursor/rules/*.mdc files.
Read the relevant files under docs/.
Read docs/ROADMAP.md.
Inspect the existing implementation.
Search for existing functionality before creating new functionality.
Identify reusable services, components, utilities, types, DTOs and database models.
Make the smallest safe change required.

Do not blindly modify code.

Do not assume something is missing until the repository has been inspected.

2. Source of truth

These documents define the project:

docs/PROJECT.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/API.md
docs/ACCOUNTING.md
docs/PAYMENTS.md
docs/SECURITY.md
docs/DEVELOPMENT.md
docs/ROADMAP.md

When implementation conflicts with documentation:

Stop.
Explain the conflict.
Recommend the safest solution.
Update documentation if the architecture is intentionally changing.
Then implement.

Never silently introduce an architectural change.

3. Architecture principles

The NestJS API is the central business platform.

Next.js web, admin, reseller and Ionic mobile are clients.

Business rules belong in the backend.

The backend is authoritative for:

prices
inventory
order totals
payment status
permissions
promotions
commissions
accounting
shipping
refunds
order state transitions

Never duplicate business rules across clients.

4. Minimal changes

For every task:

Modify only required files.
Do not rewrite working code unnecessarily.
Do not refactor unrelated code.
Do not rename things without a reason.
Do not introduce unnecessary dependencies.
Reuse existing abstractions.

If a large refactor appears necessary, stop and explain why before proceeding.

5. Database rules

All database schema changes require migrations.

Never edit an already-applied migration.

Never drop tables or columns without explicit justification.

Never expose database credentials in source code.

Never use floating-point arithmetic for money.

Use transactions for operations that must be atomic.

6. Accounting rules

Accounting uses double-entry bookkeeping.

Every journal entry must balance:

Debit total = Credit total

Never invent accounting treatment.

Before changing accounting code:

Read docs/ACCOUNTING.md.
Identify the business event.
Identify affected accounts.
Determine debit/credit behavior.
Implement through the accounting domain.
Add tests.

If accounting treatment is unclear, stop rather than guessing.

7. Payment rules

Never trust payment status supplied by the frontend.

Payment status must be verified server-side.

Payment operations must be idempotent.

Webhook/callback handling must tolerate duplicate delivery.

Provider-specific code must remain inside payment-provider adapters.

Orders must depend on the internal payment abstraction, not directly on EasyPaisa or Bank Alfalah implementation details.

Never log payment credentials or sensitive payment data.

8. Security

Never commit:

passwords
API keys
AWS credentials
database credentials
payment credentials
private keys
production secrets

Never expose secrets to frontend applications.

Validate external input.

Enforce authorization server-side.

9. Testing

New business functionality requires appropriate tests.

High-risk functionality requires strong tests:

authentication
authorization
payments
orders
inventory
refunds
accounting
reseller commissions

Never delete tests to make a change pass.

10. Development workflow

Before implementation:

Understand.
Inspect.
Plan.
Implement.
Test.
Review diff.
Document if required.
Update roadmap if the milestone is complete.

Keep tasks small.

Prefer:

"Create Product entity"

over:

"Build the entire product system."

11. Cursor efficiency

Do not read the entire repository unless necessary.

Read only the relevant files.

Do not regenerate existing files.

Do not repeatedly explain architecture in every task if the rules already contain it.

Keep Agent tasks focused and independently testable.

Do not allow long autonomous loops.

12. Completion requirement

Before declaring a task complete:

Run relevant tests.
Run type checking.
Run linting where applicable.
Review git diff.
Confirm no unrelated files changed.
Confirm no secrets were introduced.
Update documentation if required.

Then provide:

What changed.
Files changed.
Tests/checks performed.
Any unresolved issue.