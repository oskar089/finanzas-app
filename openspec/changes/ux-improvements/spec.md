# UX Improvements — Delta Spec

## Overview

Three UX enhancements within movement management: confirm-before-delete, success feedback after add, and concept text filter. All features coexist — no behavior is removed or replaced.

**No test framework available** — acceptance criteria are manual-testable.

---

## 1. Confirm Before Delete

### Requirement: Confirm delete

When the user clicks "Eliminar" on a movement row, the system MUST show a browser-native confirmation dialog. Deletion MUST only proceed if the user confirms.

#### Scenario: Delete confirmed

- GIVEN a movement row is visible in the table
- WHEN the user clicks "Eliminar" and clicks "Aceptar" on the confirm dialog
- THEN the movement is removed from localStorage and the table re-renders
- AND the balance updates to reflect the removal

#### Scenario: Delete cancelled

- GIVEN a movement row is visible in the table
- WHEN the user clicks "Eliminar" and clicks "Cancelar" on the confirm dialog
- THEN no change occurs — the movement remains, localStorage is untouched, no re-render happens

#### Scenario: Concept shown in dialog

- GIVEN a movement row with concepto "Café"
- WHEN the user clicks "Eliminar"
- THEN the dialog text MUST include the concept name: `¿Eliminar movimiento "Café"?`
- AND the concept name MUST be trimmed to 60 characters max if longer, with "..." appended

#### Edge case: Rapid double-click

- GIVEN the confirm dialog is visible
- WHEN the user clicks "Eliminar" again before dismissing
- THEN the second click is ignored (dialog is already open, no second deletion occurs)

---

## 2. Visual Feedback After Adding

### Requirement: Success alert after add

After a valid movement is submitted and saved, the system MUST show a non-modal success alert that auto-dismisses after 3 seconds.

#### Scenario: Success alert appears and auto-dismisses

- GIVEN the form has valid data
- WHEN the user submits the form
- THEN a Bootstrap `alert-success` appears with text "Movimiento agregado ✓"
- AND the alert auto-dismisses after 3 seconds (removed from DOM)
- AND the form resets and the table updates normally

#### Scenario: Multiple rapid submissions

- GIVEN a previous success alert is still visible (within 3s)
- WHEN the user submits another valid movement
- THEN the previous alert MUST be removed from DOM immediately
- AND the new success alert appears (single alert at a time)

#### Scenario: Validation failure does not show success alert

- GIVEN the form has invalid data (empty concepto, missing date, etc.)
- WHEN the user submits the form
- THEN no success alert appears
- AND the native `alert()` validation message shows instead

#### Edge case: Alert position

- GIVEN the success alert is visible
- THEN it MUST appear between the "Nuevo Movimiento" card-header and the form, inside the card-body, at the top
- AND it MUST NOT overlap or shift the form layout — it is inserted as the first child of `.card-body` inside the form card

---

## 3. Filter/Search by Concept

### Requirement: Concept text filter

A text input in the "Filtrar movimientos" card MUST filter the movements table by concept using case-insensitive substring matching, AND-combined with all existing filters.

#### Scenario: Filter matches by substring

- GIVEN movements with conceptos "Café", "Cena", "Cine"
- WHEN the user types "ce" in the concept filter input
- THEN only "Cena" and "Cine" appear in the table (case-insensitive match)
- AND "Café" is hidden

#### Scenario: Filter with no matches

- GIVEN movements with conceptos "Café", "Cena"
- WHEN the user types "zzz"
- THEN the table shows zero rows
- AND the balance shows "Balance: €0.00"

#### Scenario: Empty filter shows all

- GIVEN movements exist in the table
- WHEN the concept filter input is empty
- THEN all movements matching other active filters appear normally

#### Scenario: AND-combined with other filters

- GIVEN filterTipo = "gasto" and the concept filter input = "ce"
- WHEN movements are rendered
- THEN only "gasto" entries whose concepto contains "ce" (case-insensitive) appear

#### Edge case: Special regex characters

- GIVEN a movement with concepto "test (urgente)"
- WHEN the user types "(" in the concept filter input
- THEN the system matches literally (no regex errors), showing only movements containing "("

#### Edge case: Whitespace handling

- GIVEN a movement with concepto "Café"
- WHEN the user types " café " (with leading/trailing spaces)
- THEN the trimmed input matches "Café" — leading/trailing whitespace MUST be trimmed before matching

#### Edge case: Long search string

- GIVEN 100 movements with various conceptos
- WHEN the user types a 200-character string
- THEN the system handles it without errors — zero matches is expected but no crash occurs