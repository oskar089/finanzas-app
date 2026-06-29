import {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  copyBudgets,
} from "./api.js";

// ============================================================
// EXPENSE CATEGORIES (solo gastos, budgets no aplican a ingresos)
// ============================================================

const CATEGORIAS_GASTO = {
  alimentacion: "Alimentación",
  transporte: "Transporte",
  entretenimiento: "Entretenimiento",
  salud: "Salud",
  housing: "Vivienda",
  utilities: "Servicios",
  "otros-gasto": "Otros",
};

// ============================================================
// DOM ELEMENTS
// ============================================================

const budgetMonth = document.getElementById("budgetMonth");
const budgetYear = document.getElementById("budgetYear");
const budgetCategory = document.getElementById("budgetCategory");
const budgetAmount = document.getElementById("budgetAmount");
const budgetForm = document.getElementById("budgetForm");
const budgetFormTitle = document.getElementById("budgetFormTitle");
const saveBudgetBtn = document.getElementById("saveBudgetBtn");
const cancelBudgetEditBtn = document.getElementById("cancelBudgetEditBtn");
const budgetsContainer = document.getElementById("budgetsContainer");
const btnCopyBudgets = document.getElementById("btnCopyBudgets");

// ============================================================
// STATE
// ============================================================

let budgets = [];
let editingBudgetId = null;

// ============================================================
// UTILITY FUNCTIONS (matching app.js pattern)
// ============================================================

function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showToast(mensaje, tipo = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `app-toast app-toast-${tipo}`;
  toast.textContent = mensaje;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  }, 3500);
}

function showConfirm(mensaje) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirmOverlay");
    const messageEl = document.getElementById("confirmMessage");
    const acceptBtn = document.getElementById("confirmAcceptBtn");
    const cancelBtn = document.getElementById("confirmCancelBtn");

    messageEl.textContent = mensaje;
    overlay.classList.remove("d-none");

    const cleanup = (resultado) => {
      overlay.classList.add("d-none");
      acceptBtn.removeEventListener("click", onAccept);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
      resolve(resultado);
    };

    const onAccept = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlayClick = (e) => {
      if (e.target === overlay) cleanup(false);
    };

    acceptBtn.addEventListener("click", onAccept);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
}

function getEtiquetaCategoria(categoria) {
  return CATEGORIAS_GASTO[categoria] || categoria;
}

// ============================================================
// POPULATE MONTH/YEAR SELECTORS
// ============================================================

function populateMonthYear() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const meses = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  budgetMonth.innerHTML = "";
  for (let i = 1; i <= 12; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = meses[i - 1];
    if (i === currentMonth) opt.selected = true;
    budgetMonth.appendChild(opt);
  }

  budgetYear.innerHTML = "";
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === currentYear) opt.selected = true;
    budgetYear.appendChild(opt);
  }
}

// ============================================================
// LOAD BUDGETS
// ============================================================

async function loadBudgets() {
  try {
    budgetsContainer.innerHTML =
      '<p class="text-muted mb-0">Cargando presupuestos...</p>';

    const month = parseInt(budgetMonth.value);
    const year = parseInt(budgetYear.value);

    const data = await getBudgets({ month, year });
    budgets = data.budgets || [];

    renderBudgets();
  } catch (err) {
    console.error("Error loading budgets:", err);
    showToast("Error al cargar presupuestos", "danger");
    budgetsContainer.innerHTML =
      '<p class="text-muted mb-0">Error al cargar presupuestos.</p>';
  }
}

// ============================================================
// RENDER
// ============================================================

function renderBudgets() {
  if (budgets.length === 0) {
    budgetsContainer.innerHTML =
      '<p class="text-muted mb-0">No hay presupuestos para este mes. Creá uno arriba.</p>';
    return;
  }

  budgetsContainer.innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>Categoría</th>
          <th>Presupuestado</th>
          <th>Gastado</th>
          <th>Restante</th>
          <th>Progreso</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${budgets.map((b) => renderBudgetRow(b)).join("")}
      </tbody>
    </table>
  `;
}

function renderBudgetRow(b) {
  const progressClass = b.isOverBudget
    ? "bg-danger"
    : b.isWarning
      ? "bg-warning"
      : "bg-success";

  const progressStyle = `width: ${Math.min(b.percentage, 100)}%`;

  return `
    <tr>
      <td>${escapeHTML(getEtiquetaCategoria(b.category))}</td>
      <td>${formatCurrency(Number(b.amount))}</td>
      <td>${formatCurrency(Number(b.spent))}</td>
      <td class="${b.remaining < 0 ? "text-danger fw-bold" : ""}">${formatCurrency(Number(b.remaining))}</td>
      <td>
        <div class="progress" style="height: 20px;">
          <div class="progress-bar ${progressClass}" role="progressbar" style="${progressStyle}" aria-valuenow="${b.percentage}" aria-valuemin="0" aria-valuemax="100">
            ${b.percentage.toFixed(0)}%
          </div>
        </div>
      </td>
      <td>
        <button class="btn-editar btn-edit-budget" data-id="${escapeHTML(b.id)}">Editar</button>
        <button class="btn-eliminar btn-delete-budget" data-id="${escapeHTML(b.id)}">Eliminar</button>
      </td>
    </tr>
  `;
}

// ============================================================
// FORM HANDLERS
// ============================================================

function cancelBudgetEdit() {
  editingBudgetId = null;
  budgetForm.reset();
  budgetFormTitle.textContent = "Nuevo Presupuesto";
  saveBudgetBtn.textContent = "Guardar";
  cancelBudgetEditBtn.classList.add("d-none");
}

cancelBudgetEditBtn.addEventListener("click", cancelBudgetEdit);

budgetForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const category = budgetCategory.value;
  const amountText = budgetAmount.value.trim();
  const amount = Number(amountText.replace(",", "."));

  if (!amountText || isNaN(amount) || amount <= 0) {
    showToast("Ingresá un monto válido mayor a 0.", "warning");
    return;
  }

  const month = parseInt(budgetMonth.value);
  const year = parseInt(budgetYear.value);

  try {
    if (editingBudgetId) {
      // Solo se actualiza el monto — categoría/mes/año son inmutables
      await updateBudget(editingBudgetId, { amount });
      showToast("Presupuesto actualizado ✓", "success");
    } else {
      await createBudget({ category, amount, month, year });
      showToast("Presupuesto creado ✓", "success");
    }

    cancelBudgetEdit();
    await loadBudgets();
  } catch (err) {
    showToast(err.message || "Error al guardar el presupuesto", "danger");
  }
});

// ============================================================
// TABLE ACTIONS (event delegation)
// ============================================================

budgetsContainer.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-edit-budget")) {
    const id = e.target.dataset.id;
    const budget = budgets.find((b) => b.id === id);
    if (!budget) return;

    budgetCategory.value = budget.category;
    budgetAmount.value = budget.amount;
    editingBudgetId = budget.id;

    budgetFormTitle.textContent = "Editar Presupuesto";
    saveBudgetBtn.textContent = "Guardar Cambios";
    cancelBudgetEditBtn.classList.remove("d-none");
    budgetForm.scrollIntoView({ behavior: "smooth" });
  }

  if (e.target.classList.contains("btn-delete-budget")) {
    const id = e.target.dataset.id;
    const budget = budgets.find((b) => b.id === id);
    if (!budget) return;

    const label = getEtiquetaCategoria(budget.category);
    const confirmado = await showConfirm(
      `¿Eliminar presupuesto de "${label}"?`,
    );
    if (!confirmado) return;

    try {
      await deleteBudget(id);
      if (editingBudgetId === id) cancelBudgetEdit();
      await loadBudgets();
      showToast("Presupuesto eliminado.", "success");
    } catch (err) {
      showToast(err.message || "Error al eliminar el presupuesto", "danger");
    }
  }
});

// ============================================================
// COPY BUDGETS
// ============================================================

btnCopyBudgets.addEventListener("click", async () => {
  const fromMonth = parseInt(budgetMonth.value);
  const fromYear = parseInt(budgetYear.value);

  let toMonth = fromMonth + 1;
  let toYear = fromYear;
  if (toMonth > 12) {
    toMonth = 1;
    toYear = fromYear + 1;
  }

  const confirmado = await showConfirm(
    `¿Copiar los presupuestos de ${fromMonth}/${fromYear} a ${toMonth}/${toYear}?`,
  );
  if (!confirmado) return;

  try {
    const result = await copyBudgets(fromMonth, fromYear, toMonth, toYear);
    showToast(
      result.message || `✅ Presupuestos copiados a ${toMonth}/${toYear}`,
      "success",
    );
    await loadBudgets();
  } catch (err) {
    showToast(err.message || "Error al copiar presupuestos", "danger");
  }
});

// ============================================================
// MONTH/YEAR CHANGE RELOADS BUDGETS
// ============================================================

budgetMonth.addEventListener("change", loadBudgets);
budgetYear.addEventListener("change", loadBudgets);

// ============================================================
// INIT
// ============================================================

populateMonthYear();

export { loadBudgets };
