# Delta for dashboard-analytics

## MODIFIED Requirements

### Requirement: Monthly Comparison (Chart Wired)

The system MUST return monthly income/expense aggregates at GET /api/dashboard/monthly using a single GROUP BY query instead of per-month queries.
(Previously: one query per month — 6 queries for a 6-month view)

#### Scenario: Get monthly comparison

- GIVEN a user with transactions in June and July 2026
- WHEN GET /api/dashboard/monthly is called
- THEN the response returns an array of { month, year, totalIncome, totalExpenses } entries
- AND the data is computed in a single GROUP BY query

#### Scenario: Monthly with empty months

- GIVEN a user with transactions in only 2 of the last 6 months
- WHEN GET /api/dashboard/monthly is called
- THEN the response includes entries for all 6 months with zero values for months with no data

#### Scenario: Monthly chart renders with dark mode

- GIVEN the frontend rendering the monthly comparison chart
- WHEN the user toggles dark mode
- THEN the chart bar colors update to dark-theme variants

### Requirement: Dashboard Summary (Aggregated)

The system MUST return a comprehensive dashboard summary. Recent transactions MUST be limited to the 5 most recent entries using `take:5`.
(Previously: fetched all transactions — unbounded result set)

#### Scenario: Get full dashboard

- GIVEN an authenticated user with total income 5000 and total expenses 3000
- WHEN GET /api/dashboard is called
- THEN the response includes totalBalance: 2000, totalIncome: 5000, totalExpenses: 3000
- AND recentTransactions contains at most 5 entries
- AND includes expensesByCategory with grouped expense amounts
- AND includes dailyBalance as chronological balance snapshots

#### Scenario: User with no transactions

- GIVEN a newly registered user with no transactions
- WHEN GET /api/dashboard is called
- THEN the response includes totalBalance: 0, totalIncome: 0, totalExpenses: 0
- AND recentTransactions is an empty array
