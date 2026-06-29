# Apply Progress: UX Improvements

**Mode**: Standard (no test runner)
**Delivery**: single-pr | size:exception
**Estimated lines**: ~28 (actual ~40)

### Completed Tasks

- [x] 1.1 `index.html` — Added `<div class="col-md-3">` with `<input id="filterConcepto">` after the Monto máx. field, inside the filters card grid
- [x] 1.2 `app.js` — Added `let filterConcepto = "";` state variable at line 18
- [x] 1.3 `app.js` — Added concept filter check in `getMovimientosFiltrados()`: case-insensitive substring match with `.toLowerCase().includes()`, trims input whitespace, skips when filterConcepto is empty
- [x] 1.4 `app.js` — Added `"input"` event listener for `#filterConcepto` that updates `filterConcepto` and calls `renderMovimientos()` + `actualizarBalance()`
- [x] 2.1 `app.js` — In btn-eliminar handler: looks up movement by id, trims concept to 60 chars with "..." if longer, guards with `confirm(\`¿Eliminar movimiento "${label}"?\`)` before delete
- [x] 3.1 `app.js` — Added `let successAlertTimer = null;` module-level variable at line 19
- [x] 3.2 `app.js` — After `form.reset()`: clears previous timer, removes existing `.alert-success`, creates new Bootstrap `alert-success` with "Movimiento agregado ✓", inserts as first child of form's `.card-body`, sets `setTimeout(3000)` to remove it

### Deviations from Design
- **Design artifact not found** in engram (no `sdd/ux-improvements/design`). Implementation followed spec and tasks only.
- Used `form.parentElement` to get the `.card-body` for alert insertion instead of a hardcoded selector — more robust to DOM changes.
- Alert timeout set to **3000ms** (3 seconds) per spec, not 2500ms as mentioned in the launch prompt.

### Issues Found
None.

### Status
7/10 tasks complete. Tasks 4.1–4.3 (manual testing) are for the user to execute.