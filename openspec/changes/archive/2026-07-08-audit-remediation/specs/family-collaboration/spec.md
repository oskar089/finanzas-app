# Delta for family-collaboration

## MODIFIED Requirements

### Requirement: Family UI Helpers

The frontend MUST use shared utility functions (formatCurrency, formatDate, etc.) imported from a common module rather than duplicating their definitions across multiple files.
(Previously: family.js duplicated helper definitions shared with other modules — maintenance risk, inconsistent behavior)

#### Scenario: Shared currency formatting

- GIVEN the family management page rendering member balances
- WHEN the page displays a monetary value
- THEN it MUST use the shared formatCurrency utility from js/utils.js (or equivalent shared module)
- AND the same utility MUST be used by transactions.js and dashboard.js for consistency

#### Scenario: Duplicated function removed

- GIVEN the family.js file previously had inline copies of formatCurrency and formatDate
- WHEN the deduplication refactor is complete
- THEN family.js MUST import those functions from the shared module
- AND the inline copies MUST be removed
