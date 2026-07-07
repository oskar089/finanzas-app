import {
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  copyBudgets,
  getCategories,
} from "./api.js";
import { escapeHTML, showToast, showConfirm, formatCurrency } from "./shared.js";

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
// POPULATE BUDGET CATEGORY SELECT
// ============================================================

export function poblarBudgetCategorias(categorias) {
  if (!budgetCategory) return;
  const expenses = categorias.filter((c) => c.type === "EXPENSE");
  if (expenses.length > 0) {
    budgetCategory.innerHTML =
      '<option value="">Seleccionar categoría</option>' +
      expenses
        .map(
          (c) =>
            `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`,
        )
        .join("");
  } else {
    // Fallback: categorías hardcodeadas si no hay en DB
    budgetCategory.innerHTML =
      '<option value="">Seleccionar categoría</option>' +
      Object.entries(CATEGORIAS_GASTO)
        .map(
          ([key, label]) =>
            `<option value="${escapeHTML(key)}">${escapeHTML(label)}</option>`,
        )
        .join("");
  }
}

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
