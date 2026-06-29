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

#### Known Issue: Update with accountId change

- GIVEN an EXPENSE transaction on account A being updated to account B
- WHEN the endpoint is called with a different accountId
- THEN account A balance is NOT restored AND account B balance is NOT adjusted
- AND this is a known bug — balance drift occurs

### Requirement: Delete Transaction

The system MUST delete a transaction and reverse its balance effect on the account.

#### Scenario: Delete expense reverses balance

- GIVEN an EXPENSE transaction of 100 on account A (balance 500)
- WHEN DELETE /api/transactions/:id is called
- THEN account A balance returns to 600 (pre-expense amount)

### Requirement: CSV Export

The system MUST export transactions as CSV with a BOM for Excel compatibility.

#### Scenario: Export filtered transactions

- GIVEN a user with 20 transactions, 5 of type EXPENSE
- WHEN GET /api/transactions/export?type=EXPENSE is called
- THEN a CSV file is returned with BOM prefix and 5 expense rows

### Requirement: CSV Import

The system MUST import transactions from a CSV upload (bulk create).

#### Scenario: Import valid CSV

- GIVEN an authenticated user with a valid CSV file containing 10 transaction rows
- WHEN POST /api/transactions/import is called with the CSV file
- THEN 10 transactions are created and account balances are adjusted accordingly

#### Scenario: Import with invalid row

- GIVEN a CSV file with one row missing the amount field
- WHEN POST /api/transactions/import is called
- THEN the API returns a 400 error detailing the invalid row
- AND no transactions from the file are persisted

### Known Gap: Search

The legacy FE supports concept/substring search but the canonical frontend does NOT expose a search input. This functionality exists on the backend but has no UI in the new SPA.
