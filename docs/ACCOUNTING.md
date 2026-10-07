Accounting System
Principle

The accounting system uses double-entry bookkeeping.

Every journal entry must satisfy:

Total Debits = Total Credits

Account hierarchy

Initial chart of accounts:

1000 Assets

1100 Cash
1200 Bank
1300 Accounts Receivable
1400 Inventory
1500 Payment Gateway Receivable

2000 Liabilities

2100 Accounts Payable
2200 Taxes Payable
2300 Refunds Payable
2400 Reseller Commissions Payable

3000 Equity

3100 Owner Capital
3200 Retained Earnings

4000 Revenue

4100 Product Sales
4200 Shipping Revenue
4300 Other Revenue

5000 Cost of Goods Sold

5100 Cost of Goods Sold

6000 Expenses

6100 Marketing Expense
6200 Shipping Expense
6300 Payment Gateway Fees
6400 Salaries
6500 General Expenses


This chart is a starting structure and must be adapted to the actual business/accounting requirements.

Accounting events

Potential events:

product sale
product refund
inventory purchase
inventory adjustment
COGS
payment gateway fee
shipping revenue
shipping expense
reseller commission
tax
manual adjustment
Example sale

A simplified cash sale can result in:

Dr Cash / Payment Receivable
    Cr Product Sales Revenue

Dr Cost of Goods Sold
    Cr Inventory


The exact accounts depend on payment method and business policy.

COD treatment (current MVP)

No sale journals when the customer places an order (`placed`).

When an admin confirms the order by moving it to `processing` (or directly to `shipped`):

- Inventory: reservation is consumed (reserved ↓, on-hand ↓) before journals post
- Dr 1300 Accounts Receivable / Cr 4100 Product Sales = merchandise net (`subtotal − discount_amount`)
- Dr 1300 Accounts Receivable / Cr 4200 Shipping Revenue = shipping (when > 0)
- Dr 5100 COGS / Cr 1400 Inventory = Σ(unit cost × qty) when product cost > 0

Promo discounts reduce Product Sales / AR for merchandise only. Shipping revenue is never reduced by promo codes. There is no separate discount contra-revenue account in this MVP.

Place order reserves stock only (no journals). Cancel while reserved releases the hold (no journals to reverse). Cancel after confirm reverses posted journals and restores on-hand.

When the order becomes `delivered` (COD collected):

- Dr 1100 Cash / Cr 1300 Accounts Receivable = order total (`subtotal − discount + shipping`)

Cancel reverses all journals already posted for that order (idempotent). Journals are immutable; corrections use reversing entries. Admin order delete uses the same reverse path (including for delivered orders).

Refund

Refunds must reverse the appropriate revenue/payment/inventory effects according to the actual business process.

COD return treatment (implemented):

1. Admin creates a return on a **delivered** order (merchandise lines only; shipping never refunded). Window: 14 days from delivery.
2. On **inspect & restock**:
   - Dr 4100 Product Sales / Cr 2300 Refunds Payable = merchandise refund amount
   - Dr 1400 Inventory / Cr 5100 COGS = unit cost × returned qty (when cost > 0)
   - Inventory on-hand increases (`return_restock`)
3. On **mark bank refund paid**:
   - Dr 2300 Refunds Payable / Cr 1200 Bank = same refund amount

Inventory

Inventory changes must remain consistent with accounting.

Historical records

Never silently modify historical journal entries.

Corrections should use explicit reversal or adjustment entries.

Financial reports

The system should eventually provide:

general ledger
trial balance
profit and loss
balance sheet
account statement
sales report
inventory valuation
payment reconciliation

Admin MVP reports (implemented):

- Trial balance — net debit/credit per account (all time)
- General ledger — journal lines with optional account code and entry-date window
- Profit & loss — revenue and expense totals for an optional entry-date window
- Balance sheet — assets, liabilities, equity as of an optional entry date; period net income is shown separately so Assets ≈ Liabilities + Equity + Net income

Payment gateway fees and reseller commission journals remain deferred. Refund journals for returns: see COD return treatment above.

Critical rule

Do not invent accounting treatment when requirements are ambiguous.