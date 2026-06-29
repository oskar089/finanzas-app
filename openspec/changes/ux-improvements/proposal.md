# Proposal: UX Improvements

## Intent
Three user-facing UX gaps: (1) deleting a movement has no confirmation → accidental data loss, (2) adding a movement gives zero feedback → user isn't sure it worked, (3) no way to search by concept → must scan the full table to find a specific entry.

## Scope

### In Scope
- Confirm dialog before deleting a movement
- Success feedback after adding a movement
- Text input to filter/search movements by concept (case-insensitive substring)

### Out of Scope
- Visual feedback for delete (only the confirm dialog)
- Edit/update functionality for movements
- Filter by any other field not already present
- Import/export enhancements
- Dark mode, charts, or other pending features

## Capabilities

### New Capabilities
None

### Modified Capabilities
None — these are UX enhancements within the existing movement management capability. No spec-level behavior contracts change.

## Approach

All three features in `app.js` (~8-12 lines each). No new files. No new dependencies (Bootstrap 5.3 already loaded).

1. **Confirm before delete** — In `btn-eliminar` click handler, wrap the filter/save/render with `if (!confirm("¿Eliminar este movimiento?")) return;`
2. **Visual feedback after add** — After `form.reset()`, show a Bootstrap alert ("Movimiento agregado ✓") that auto-dismisses after 3s via `setTimeout`.
3. **Filter by concept** — Add `filterConcepto` state variable, add `<input>` in the filters card (Bootstrap grid), extend `getMovimientosFiltrados()` with case-insensitive `String.includes()` check.

## Affected Areas

| Area | Impact | Description |
|------|--------|------------|
| `index.html` | Modified | Add search input in filters card |
| `app.js` | Modified | Add confirm, success alert, concept filter |
| `styles.css` | None | Existing styles suffice |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `confirm()` blocks UX (can't style it) | Low | Acceptable for this scope. Bootstrap modal as future enhancement |
| Auto-dismiss alert appears during other operations | Low | Single alert at a time, tied to form submit context only |
| Concept filter conflicts with existing filters | Low | Works additively (AND) with existing filter chain |

## Rollback Plan
Revert changes via `git checkout -- app.js index.html`.

## Dependencies
None.

## Success Criteria
- [ ] Clicking "Eliminar" shows a confirmation dialog; canceling does nothing
- [ ] Submitting a valid movement shows a success message that disappears after 3s
- [ ] Typing in the concept search input filters the table to matching rows (case-insensitive)