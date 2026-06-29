# Transaction Management Specification

## Purpose

Manage financial transactions (INCOME, EXPENSE, TRANSFER) with CRUD, filtering, sorting, pagination, and CSV import/export.

## Requirements

### Requirement: Create Transaction

The system MUST create a transaction of type INCOME, EXPENSE, or TRANSFER and adjust the associated account balance.

#### Scenario: Create income transaction

- GIVEN an authenticated user with a CHECKING account
- WHEN POST /api/transactions is called with type "INCOME", amount 500, category "other"
- THEN the transaction is created AND the account balance increases by 500
- AND the response includes the transaction id, type, amount, and category

#### Scenario: Create expense with insufficient balance

- GIVEN a CHECKING account with balance 100
- WHEN POST /api/transactions is called with type "EXPENSE", amount 200, same account
- THEN the transaction is still created
- AND the account balance becomes -100 (negative balances are permitted)

### Requirement: List Transactions

The system MUST list transactions with filtering (type, category, date range, amount range), sorting (any column, asc/desc), and pagination (page/limit).

#### Scenario: Filter by type and date range

- GIVEN a user with 10 EXPENSE and 5 INCOME transactions
- WHEN GET /api/transactions?type=INCOME&startDate=2026-01-01&endDate=2026-06-30
- THEN only INCOME transactions within the date range are returned

#### Scenario: Sort by amount descending

- GIVEN a user with transactions of varying amounts
- WHEN GET /api/transactions?sortBy=amount&sortOrder=desc
- THEN transactions are returned ordered by amount descending

### Requirement: Update Transaction

The system MUST update a transaction and adjust account balances accordingly.

#### Scenario: Update transaction amount

- GIVEN an EXPENSE transaction of 100 on account A
- WHEN PUT /api/transactions/:id is called with amount 150
- THEN account A balance is reduced by an additional 50

#### Scenario: Update with accountId change

- GIVEN an EXPENSE transaction of 100 on account A (balance 500)
- AND the transaction is being updated to account B (balance 1000)
- WHEN PUT /api/transactions/:id is called with accountId B
- THEN account A balance is restored to 600 (reverses the expense)
- AND account B balance is reduced to 900 (applies the expense)
- AND all balance changes happen atomically within a Prisma $transaction

### Requirement: Delete Transaction

The system MUST delete a transaction and reverse its balance effect on the account.

#### Scenario: Delete expense reverses balance

- GIVEN an EXPENSE transaction of 100 on account A (balance 500)
- WHEN DELETE /api/transactions/:id is called
- THEN account A balance returns to 600 (pre-expense amount)

### Requirement: CSV Export (Client-Side)

The system MUST allow exporting transactions as CSV with a BOM for Excel compatibility. Export is implemented CLIENT-SIDE (not as a dedicated API endpoint).

#### Scenario: Export filtered transactions

- GIVEN a user with transactions loaded in the frontend
- WHEN the user clicks "Export CSV"
- THEN a CSV file is generated client-side with BOM prefix and downloaded

### Requirement: CSV Import (Bulk JSON)

The system MUST support bulk transaction import. The frontend parses the CSV, then sends the data as JSON to a bulk API endpoint.

#### Scenario: Import valid CSV

- GIVEN an authenticated user with a valid CSV file
- WHEN the frontend parses the CSV and POST /api/transactions/bulk is called with JSON array
- THEN all transactions are created and account balances are adjusted atomically

#### Scenario: Import with invalid row

- GIVEN a CSV file with one row missing the amount field
- WHEN the frontend parses the CSV and sends to POST /api/transactions/bulk
- THEN the API returns a 400 error for the invalid row
- AND valid rows are still created (partial success)

### Known Gap: Search

The legacy FE supports concept/substring search but the canonical frontend did NOT expose a search input. This has been FIXED — the concept filter now works end-to-end (FE sends param, BE filters by description).
