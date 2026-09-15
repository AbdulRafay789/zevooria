Payment Architecture
Providers

Initial providers:

EasyPaisa
Bank Alfalah
Abstraction

Business logic must interact with:

PaymentService


which delegates to:

PaymentProvider


Provider implementations:

EasyPaisaProvider
BankAlfalahProvider

Payment lifecycle
CREATED
   ↓
PENDING
   ↓
PROCESSING
   ↓
SUCCESS


Failure paths:

PENDING → FAILED
PENDING → EXPIRED
PROCESSING → FAILED


Refund:

SUCCESS → REFUNDED

Security

Never trust frontend payment status.

The backend must verify payment.

Idempotency

Payment creation and webhook handling must be idempotent.

Duplicate callbacks must not:

duplicate orders
duplicate payments
duplicate accounting entries
duplicate inventory changes
Provider transaction IDs

Store provider references for reconciliation.

Webhooks

Webhook processing must:

authenticate/verify the callback
identify the transaction
check whether it was already processed
update payment state
update order state when appropriate
create accounting effects when appropriate
return safely
Secrets

Provider credentials must remain server-side.

Never expose them to web or mobile clients.

Reconciliation

Payment records should support reconciliation against provider transaction references.