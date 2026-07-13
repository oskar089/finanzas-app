# Delta for account-management

## MODIFIED Requirements

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
