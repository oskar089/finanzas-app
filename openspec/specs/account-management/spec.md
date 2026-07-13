# Account Management Specification

## Purpose

Manage financial accounts (CHECKING, SAVINGS, CREDIT_CARD, CASH) with CRUD operations, balance tracking, and balance history.

## Requirements

### Requirement: Create Account

The system MUST create an account with a name, type, initial balance, and currency.

#### Scenario: Create account successfully

- GIVEN an authenticated user
- WHEN POST /api/accounts is called with type "CHECKING", name "Main Account", and initial balance 1000
- THEN an account record is created and the response includes the account id, type, name, and balance

#### Scenario: Invalid account type

- GIVEN an authenticated user
- WHEN POST /api/accounts is called with type "INVESTMENT"
- THEN the API returns a 400 Bad Request error indicating invalid account type
- AND no account is created

### Requirement: List Accounts

The system MUST return all non-deleted accounts for the authenticated user.

#### Scenario: List accounts

- GIVEN an authenticated user with 2 active accounts and 1 soft-deleted account
- WHEN GET /api/accounts is called
- THEN the response returns only the 2 active accounts with their balances

### Requirement: Update Account

The system MUST update an account's name and type.

#### Scenario: Update account name

- GIVEN an authenticated user with an existing account
- WHEN PUT /api/accounts/:id is called with updated name "Joint Account"
- THEN the account name is updated and the new account state is returned

#### Scenario: Update non-existent account

- GIVEN an authenticated user
- WHEN PUT /api/accounts/99999 is called
- THEN the API returns a 404 Not Found error

### Requirement: Soft-Delete Account

The system MUST soft-delete an account by setting a `deletedAt` timestamp within a Prisma $transaction to prevent race conditions. The system SHOULD prevent deleting an account with active transactions unless confirmed.
(Previously: soft-delete without $transaction — race condition allowed concurrent balance reads)

#### Scenario: Delete account with transactions

- GIVEN an account that has associated transactions
- WHEN DELETE /api/accounts/:id is called
- THEN the API returns a 409 Conflict error with message "Account has transactions"

#### Scenario: Delete empty account (race-condition-free)

- GIVEN an account with no transactions
- WHEN DELETE /api/accounts/:id is called
- THEN the account's `deletedAt` field is set atomically within a Prisma $transaction
- AND subsequent list calls exclude it
- AND concurrent delete requests for the same account do not cause double-deletion or data inconsistency

### Requirement: Balance History

The system MUST provide daily balance history for an account over a date range.

#### Scenario: Get balance history

- GIVEN an account with transactions spanning the past 30 days
- WHEN GET /api/accounts/:id/balance-history is called
- THEN the response returns an array of daily balance snapshots

### Requirement: Atomic Balance Updates

The system MUST update account balances atomically within Prisma $transaction blocks when creating, updating, or deleting transactions.

#### Scenario: Balance consistency on transfer

- GIVEN a user with account A (balance 1000) and account B (balance 500)
- WHEN a TRANSFER-type transaction of 200 from A to B is created
- THEN account A balance is 800 AND account B balance is 700
- AND both values are updated within the same database transaction

#### Known Gap: Account CRUD Frontend

The frontend only displays accounts in a dropdown selector. Create, edit, and delete account UI does NOT exist — these operations are only accessible via the API.
