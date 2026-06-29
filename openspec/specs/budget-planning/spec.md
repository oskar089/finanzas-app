# Budget Planning Specification

## Purpose

Allow users to set monthly budgets per expense category, track actual spending against limits, and copy budgets between months.

## Requirements

### Requirement: Create Budget

The system MUST create a budget for a specific category, month, and year. Duplicate (userId, category, month, year) MUST be rejected.

#### Scenario: Create budget successfully

- GIVEN an authenticated user
- WHEN POST /api/budgets is called with category "food", month 6, year 2026, amount 500
- THEN a budget record is created with the given category, month, year, and amount

#### Scenario: Duplicate budget rejected

- GIVEN an existing budget for category "food", month 6, year 2026
- WHEN POST /api/budgets is called with the same category, month, and year
- THEN the API returns a 409 Conflict error with message "Budget already exists for this category and period"

### Requirement: List Budgets

The system MUST return all budgets for the authenticated user, optionally filtered by month and year.

#### Scenario: List budgets for a month

- GIVEN a user with 3 budgets for June 2026 and 2 budgets for July 2026
- WHEN GET /api/budgets?month=6&year=2026 is called
- THEN the response returns only the 3 budgets for June 2026

### Requirement: Update Budget

The system MUST update the budgeted amount for an existing budget.

#### Scenario: Update budget amount

- GIVEN an existing budget for "food" with amount 500
- WHEN PUT /api/budgets/:id is called with amount 600
- THEN the budget amount is updated to 600

### Requirement: Delete Budget

The system MUST delete a budget.

#### Scenario: Delete existing budget

- GIVEN an existing budget with id 1
- WHEN DELETE /api/budgets/1 is called
- THEN the budget is removed from the database and subsequent list calls exclude it

#### Scenario: Delete non-existent budget

- GIVEN no budget with id 99999
- WHEN DELETE /api/budgets/99999 is called
- THEN the API returns a 404 Not Found error

### Requirement: Spending Tracking

The system MUST return actual spending vs budgeted amount per category for a given period.

#### Scenario: Get budget summary with spending

- GIVEN a budget of 500 for "food" in June 2026 and 300 in expense transactions for that category
- WHEN GET /api/budgets/summary?month=6&year=2026 is called
- THEN the response includes { category: "food", budgeted: 500, spent: 300, remaining: 200 }

### Requirement: Copy Budget Between Months

The system MUST copy all budgets from one month to another, overwriting existing budgets in the target month.

#### Scenario: Copy budgets to next month

- GIVEN 3 budgets for June 2026 and no budgets for July 2026
- WHEN POST /api/budgets/copy is called with sourceMonth 6, sourceYear 2026, targetMonth 7, targetYear 2026
- THEN 3 new budget records are created for July 2026 with the same categories and amounts

#### Known Gap: Budget Frontend

All budget endpoints (CRUD, summary, copy) exist on the backend. The canonical frontend has NO budget UI — no form, no list, no spending tracker display.
