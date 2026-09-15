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

Authentication

Protected endpoints require authentication.

Authorization is checked server-side.

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