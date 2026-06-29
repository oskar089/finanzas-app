# Dashboard Analytics Specification

## Purpose

Provide financial overview through balance summaries, category-based spending charts, balance evolution charts, and monthly comparisons.

## Requirements

### Requirement: Balance Summary

The system MUST return total balance, total income, and total expenses for the authenticated user.

#### Scenario: Get summary with mixed transactions

- GIVEN an authenticated user with total income 5000 and total expenses 3000
- WHEN GET /api/dashboard/summary is called
- THEN the response includes totalBalance: 2000, totalIncome: 5000, totalExpenses: 3000

#### Scenario: User with no transactions

- GIVEN a newly registered user with no transactions
- WHEN GET /api/dashboard/summary is called
- THEN the response includes totalBalance: 0, totalIncome: 0, totalExpenses: 0

### Requirement: Expenses by Category Chart (Doughnut)

The system MUST return expense amounts grouped by category for the doughnut chart.

#### Scenario: Category breakdown

- GIVEN a user with expenses 300 in "food", 200 in "transport", 100 in "health"
- WHEN GET /api/dashboard/expenses-by-category is called
- THEN the response returns an array of { category, amount } pairs for each category

#### Scenario: No expenses in period

- GIVEN a user with no expenses in the selected period
- WHEN GET /api/dashboard/expenses-by-category is called
- THEN the response returns an empty array

### Requirement: Balance Evolution Chart (Line)

The system MUST return daily balance snapshots over time for the line chart.

#### Scenario: Get daily balance series

- GIVEN a user with transactions over 7 days
- WHEN GET /api/dashboard/daily-balance is called
- THEN the response returns an array of { date, balance } entries in chronological order

#### Scenario: Single-day balance

- GIVEN a user with a single transaction today
- WHEN GET /api/dashboard/daily-balance?startDate=2026-06-29&endDate=2026-06-29 is called
- THEN the response returns exactly one entry with that day's balance

### Requirement: Monthly Comparison (Backend Only)

The system MUST return aggregated income and expense totals per month for comparison. This endpoint is backend-only — the frontend does NOT display it.

#### Scenario: Get monthly comparison

- GIVEN a user with transactions in June and July 2026
- WHEN GET /api/dashboard/monthly-comparison is called
- THEN the response returns an array of { month, year, totalIncome, totalExpenses } entries

### Requirement: Dark Mode Chart Colors

The frontend MUST update Chart.js color configurations when dark mode is toggled.

#### Scenario: Dark mode updates doughnut colors

- GIVEN the dashboard page with a visible doughnut chart in light mode
- WHEN the user enables dark mode
- THEN the chart background colors update to dark-theme palette and labels become light-colored

#### Known Gap: Monthly Comparison Frontend

The `/api/dashboard/monthly-comparison` endpoint exists but the canonical frontend has NOT wired this data to any UI component.
