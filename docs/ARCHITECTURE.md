Architecture
High-level architecture
                    INTERNET
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
      Web           Admin         Reseller
        │              │              │
        └──────────────┼──────────────┘
                       │
                       ▼
                  NestJS API
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
      PostgreSQL     S3          Redis*
          │                       │
          │                       ▼
          │                     Queue*
          │
          ▼
      Accounting

                    Ionic
                       │
                       ▼
                   NestJS API

* introduced when required

Backend domains

The backend should be organized into domains:

auth
users
customers
catalog
inventory
cart
orders
shipping
payments
accounting
resellers
promotions
cms
notifications
reports
audit
support

Application dependency direction
Clients
   ↓
API
   ↓
Domain services
   ↓
Repositories
   ↓
PostgreSQL


External providers should be isolated behind adapters.

Payment
Checkout
   ↓
PaymentService
   ↓
PaymentProvider
   ├── EasyPaisa
   └── BankAlfalah

Storage

S3 stores:

product images
category images
banners
CMS media
generated documents when required

Do not store large binary assets in PostgreSQL.

Scaling

Initial deployment:

DNS: AWS Route 53

Internet
   ↓
Nginx
   ↓
Docker
   ↓
NestJS
   ↓
RDS


Future:

CloudFront/WAF
      ↓
Load Balancer
      ↓
Multiple API instances
      ↓
Redis
      ↓
RDS


Do not implement future infrastructure until required.