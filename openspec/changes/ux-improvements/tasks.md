# Tasks: UX Improvements

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~28 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | All 3 UX features | PR 1 (single) | Independent tasks, ~28 lines total, single PR |

## Phase 1: Filter/Search by Concept

- [x] 1.1 `index.html` — Add `<div class="col-md-3">` with `<input id="filterConcepto">` inside the filters card grid (after the monto máx. field, before closing `</div>` of row)
- [x] 1.2 `app.js` — Add `let filterConcepto = "";` state variable near line 16
- [x] 1.3 `app.js` — Add concept filter check in `getMovimientosFiltrados()` before `return true`: `if (filterConcepto && !m.concepto.toLowerCase().includes(filterConcepto.toLowerCase().trim())) return false;`
- [x] 1.4 `app.js` — Add `"input"` event listener for `#filterConcepto` that sets `filterConcepto` and calls `renderMovimientos()` + `actualizarBalance()`

## Phase 2: Confirm Before Delete

- [x] 2.1 `app.js` — In `btn-eliminar` handler (line 189-196), add: look up movement by `id`, trim concept to 60 chars, guard with `if (!confirm(\`¿Eliminar movimiento "${label}"?\`)) return;` before filter/save/render

## Phase 3: Visual Feedback After Add

- [x] 3.1 `app.js` — Add `let successAlertTimer = null;` module-level variable near line 16
- [x] 3.2 `app.js` — After `form.reset()` (line 183): clear previous timer, remove existing `.alert-success`, create new Bootstrap `alert-success` with text "Movimiento agregado ✓", insert as first child of form's `.card-body`, set `setTimeout(3000)` to remove it

## Phase 4: Manual Testing

- [ ] 4.1 **Filter**: Type "ca" → verify case-insensitive match; type "zzz" → empty table; clear → all rows; combine with tipo filter; test special chars "(" and whitespace
- [ ] 4.2 **Confirm**: Click "Eliminar" → verify concept in dialog; cancel → no change; accept → movement removed; long concept → truncated to 60 chars
- [ ] 4.3 **Alert**: Submit valid movement → green alert, auto-dismiss after 3s; rapid re-submit → old alert replaced; invalid form → no alert