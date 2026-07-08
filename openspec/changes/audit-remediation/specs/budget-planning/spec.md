# Delta for budget-planning

## MODIFIED Requirements

### Requirement: Spending Tracking

The system MUST return actual spending vs budgeted amount per category for a given period. The spending data MUST be computed in a single aggregate query (GROUP BY) rather than N+1 individual queries per category.
(Previously: one query per budget category — N+1 performance issue)

#### Scenario: Get budget summary with spending

- GIVEN a user with 5 budget categories and expense transactions across all of them
- WHEN GET /api/budgets/summary?month=6&year=2026 is called
- THEN the response returns spending data per category
- AND the data is computed using a single GROUP BY query (not N+1 queries)

#### Scenario: Zero spending for a category

- GIVEN a budget for "transport" with amount 200 and no expenses in that category
- WHEN GET /api/budgets/summary is called
- THEN the response includes { category: "transport", budgeted: 200, spent: 0, remaining: 200 }
