# Dashboard Analytics Specification

## Purpose

Provide financial overview through balance summaries, category-based spending charts, balance evolution charts, and monthly comparisons — all aggregated under a single `GET /api/dashboard` endpoint (with a dedicated `/monthly` sub-endpoint for monthly comparison).

## Requirements

### Requirement: Dashboard Summary (Aggregated)

The system MUST return a comprehensive dashboard summary including totalBalance, totalIncome, totalExpenses, expensesByCategory (grouped), dailyBalance (chronological), and budgetStatus.

#### Scenario: Get full dashboard

- GIVEN an authenticated user with total income 5000 and total expenses 3000
- WHEN GET /api/dashboard is called
- THEN the response includes totalBalance: 2000, totalIncome: 5000, totalExpenses: 3000
- AND includes expensesByCategory with grouped expense amounts
- AND includes dailyBalance as chronological balance snapshots

#### Scenario: User with no transactions

- GIVEN a newly registered user with no transactions
- WHEN GET /api/dashboard is called
- THEN the response includes totalBalance: 0, totalIncome: 0, totalExpenses: 0
- AND expensesByCategory is an empty object
- AND dailyBalance is an empty array

### Requirement: Expenses by Category (Client-Side Fallback)

The frontend MAY compute expensesByCategory client-side from loaded transactions for chart rendering, rather than consuming the API's dedicated field. Both approaches produce equivalent results.

#### Scenario: Category breakdown from loaded transactions

- GIVEN a user with expenses 300 in "food", 200 in "transport", 100 in "health"
- WHEN the frontend renders the doughnut chart
- THEN it groups loaded transactions by category and renders the chart

#### Scenario: No expenses in period

- GIVEN a user with no expenses in the selected period
- WHEN the frontend renders the doughnut chart
- THEN the chart shows an empty state or no data

### Requirement: Balance Evolution (Line Chart)

The system MUST track daily balance snapshots over time.

#### Scenario: Get daily balance series

- GIVEN a user with transactions over 7 days
- WHEN GET /api/dashboard is called
- THEN dailyBalance returns an array of { date, balance } entries in chronological order

#### Scenario: Single-day balance

- GIVEN a user with a single transaction today
- WHEN GET /api/dashboard with date range params
- THEN dailyBalance returns one entry with that day's balance

### Requirement: Monthly Comparison (Chart Wired)

The system MUST return monthly income/expense aggregates at GET /api/dashboard/monthly. The frontend renders this as a bar chart (green income bars, red expense bars).

#### Scenario: Get monthly comparison

- GIVEN a user with transactions in June and July 2026
- WHEN GET /api/dashboard/monthly is called
- THEN the response returns an array of { month, year, totalIncome, totalExpenses } entries

#### Scenario: Monthly chart renders with dark mode

- GIVEN the frontend rendering the monthly comparison chart
- WHEN the user toggles dark mode
- THEN the chart bar colors update to dark-theme variants

### Requirement: Dark Mode Chart Colors

The frontend MUST update Chart.js color configurations when dark mode is toggled.

#### Scenario: Dark mode updates all chart colors

- GIVEN the dashboard page with visible doughnut, evolution, and monthly charts
- WHEN the user enables dark mode
- THEN all three charts update their color configurations to dark-theme palette
