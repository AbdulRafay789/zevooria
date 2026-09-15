Security Requirements
Authentication

Use secure authentication mechanisms.

Passwords must be securely hashed.

Authentication tokens/sessions must be protected.

Authorization

Every protected backend operation must enforce authorization.

Never rely solely on frontend role checks.

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
Logging

Do not log:

passwords
access tokens
payment credentials
private keys
unnecessary sensitive personal information
Audit

Important administrative and financial operations should be auditable.

Deployment

Production credentials must not be stored in the Git repository.