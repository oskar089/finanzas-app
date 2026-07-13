# Delta for transaction-management

## MODIFIED Requirements

### Requirement: List Transactions

The system MUST list transactions with filtering (type, category, date range, amount range), sorting (any column, asc/desc), and pagination (page/limit). The system MUST normalize decimal separators in all filter inputs — both `.` and `,` MUST be accepted as valid decimal separators.
(Previously: no decimal separator normalization — comma-separated amounts would fail or silently produce wrong results)

#### Scenario: Filter by type and date range

- GIVEN a user with 10 EXPENSE and 5 INCOME transactions
- WHEN GET /api/transactions?type=INCOME&startDate=2026-01-01&endDate=2026-06-30
- THEN only INCOME transactions within the date range are returned

#### Scenario: Sort by amount descending

- GIVEN a user with transactions of varying amounts
- WHEN GET /api/transactions?sortBy=amount&sortOrder=desc
- THEN transactions are returned ordered by amount descending

#### Scenario: Filter with comma decimal separator

- GIVEN a user with transactions including an amount of 150.50
- WHEN GET /api/transactions?minAmount=100,50&maxAmount=200,00
- THEN the API normalizes both filters to 100.50 and 200.00
- AND the transaction with amount 150.50 is included in results

## ADDED Requirements

### Requirement: Chart Error Handling

The frontend MUST display a user-visible error toast when chart rendering fails due to API errors.

#### Scenario: Chart failure shows toast

- GIVEN the dashboard page with pending chart data
- WHEN the API call for chart data fails (network error or server error)
- THEN the frontend displays an error toast with message "Error al cargar los gráficos"
- AND the charts show an empty state rather than breaking the page layout
