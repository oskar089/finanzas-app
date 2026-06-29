# Design: UX Improvements

## Overview

This change implements three independent UX enhancements to the movement management page. The scope is small enough that a full architectural design is unnecessary — the proposal's approach section provides sufficient technical direction. This design document records the implementation approach and any deviations for audit purposes.

## Implementation Approach

### 1. Confirm Before Delete

**Location**: `app.js` — `btn-eliminar` click handler (lines ~189-196)

**Algorithm**:
1. On click, find the movement object by `id` from the `movimientos` array
2. Extract `concepto`, trim to 60 chars with "..." suffix if longer
3. Show `confirm(\`¿Eliminar movimiento "${label}"?\`)`
4. If user cancels, `return` early — no deletion, no re-render
5. If user confirms, proceed with existing filter/save/render logic

**Why `confirm()`**: Native, zero dependencies, blocks event loop (intrinsically safe against rapid double-click). Acceptable UX tradeoff for this scope.

### 2. Visual Feedback After Add

**Location**: `app.js` — form submit handler after `form.reset()` (line ~183)

**Algorithm**:
1. Module-level `let successAlertTimer = null;` to track active timeout
2. On successful submit:
   - Clear any existing `successAlertTimer`
   - Remove any existing `.alert-success` from DOM
   - Create new `div.alert.alert-success` with text "Movimiento agregado ✓"
   - Insert as first child of `form.parentElement` (the `.card-body`)
   - Set `successAlertTimer = setTimeout(() => alert.remove(), 3000)`

**Why `form.parentElement`**: More robust than hardcoded selector — adapts if DOM structure changes.

### 3. Filter/Search by Concept

**Location**: 
- `index.html` — filters card grid (after Monto máx. field)
- `app.js` — state variable, `getMovimientosFiltrados()`, event listener

**Algorithm**:
1. Add `<input type="text" id="filterConcepto" placeholder="Buscar por concepto...">` in filters grid
2. Add `let filterConcepto = "";` module-level state
3. In `getMovimientosFiltrados()`, add check before `return true`:
   ```javascript
   if (filterConcepto && !m.concepto.toLowerCase().includes(filterConcepto.toLowerCase().trim())) return false;
   ```
4. Add `"input"` event listener on `#filterConcepto`:
   - Update `filterConcepto = e.target.value`
   - Call `renderMovimientos()` and `actualizarBalance()`

**Why `.includes()` not regex**: No escaping needed, inherently safe against special characters, simpler.

## Data Flow

```
User Action          State Change              DOM Update
─────────────────────────────────────────────────────────────
Click "Eliminar"     confirm() → bool          Table re-render (if confirmed)
Submit form          successAlertTimer, alert  Alert inserted, then removed after 3s
Type in filter       filterConcepto string     Table re-render (filtered)
```

## Files Modified

| File | Changes |
|------|---------|
| `index.html` | +8 lines: filter input in filters card grid |
| `app.js` | +18 lines: 2 state vars, filter logic, confirm dialog, success alert, event listener |
| `styles.css` | None — existing Bootstrap styles suffice |

## No Design Artifact Created in Engram

Note: A dedicated `sdd/ux-improvements/design` artifact was not created in Engram during the original SDD cycle. The implementation followed the spec directly. This file is created during the archive phase to maintain a complete audit trail in the OpenSpec file store.

## Deviations Documented in Apply Progress

- Used `form.parentElement` to locate `.card-body` for alert insertion instead of hardcoded selector
- Alert timeout: 3000ms (3 seconds) per spec