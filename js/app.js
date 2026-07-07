import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkCreateTransactions,
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getDashboard,
  getDashboardMonthly,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "./api.js";
import { escapeHTML, showToast, showConfirm, formatCurrency } from "./shared.js";
import { loadBudgets, poblarBudgetCategorias } from "./budgets.js";
import { loadGroups } from "./family.js";

// ============================================================
// DOM ELEMENTS
// ============================================================

const form = document.getElementById("addMovementForm");
const conceptoInput = document.getElementById("concepto");
const montoInput = document.getElementById("monto");
const tipoSelect = document.getElementById("tipo");
const categoriaInput = document.getElementById("categoria");
const fechaInput = document.getElementById("fecha");
const movimientosBody = document.getElementById("movimientosTableBody");
const balanceSpan = document.getElementById("totalBalance");
const btnCancelEdit = document.getElementById("btnCancelEdit");
const formTitle = document.getElementById("formTitle");
const accountSelect = document.getElementById("accountSelect");
const btnManageAccounts = document.getElementById("btnManageAccounts");
const accountManagementRow = document.getElementById("accountManagementRow");
const accountListRow = document.getElementById("accountListRow");
const accountForm = document.getElementById("accountForm");
const accountNameInput = document.getElementById("accountName");
const accountTypeSelect = document.getElementById("accountType");
const accountCurrencyInput = document.getElementById("accountCurrency");
const accountBalanceInput = document.getElementById("accountBalance");
const saveAccountBtn = document.getElementById("saveAccountBtn");
const cancelAccountEditBtn = document.getElementById("cancelAccountEditBtn");
const accountFormTitle = document.getElementById("accountFormTitle");
const accountsTableBody = document.getElementById("accountsTableBody");
const paginationControls = document.getElementById("paginationControls");
const pageIndicator = document.getElementById("pageIndicator");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");

const filterCategoriaSelect = document.getElementById("filterCategoria");

// ============================================================
// STATE
// ============================================================

let movimientos = [];
let cuentas = [];
let categorias = [];
let sortColumn = "date";
let sortDirection = "desc";
let filterTipo = "todos";
let filterCategoria = "todas";
let filterFechaDesde = "";
let filterFechaHasta = "";
let filterMontoMin = "";
let filterMontoMax = "";
let filterConcepto = "";
let editandoId = null;
let selectedAccountId = null;

// Account CRUD state
let editandoCuentaId = null;

// Pagination state
let currentPage = 1;
let pageSize = 20;
let pagination = null;

// ============================================================
// LOAD DATA FROM API
// ============================================================

async function loadCuentas() {
  try {
    const data = await getAccounts();
    cuentas = data.accounts || data;
    accountSelect.innerHTML =
      '<option value="">Sin cuenta</option>' +
      cuentas
        .map((c) => `<option value="${c.id}">${escapeHTML(c.name)}</option>`)
        .join("");
    renderAccountList();
  } catch (err) {
    console.error("Error loading accounts:", err);
    showToast("Error al cargar cuentas", "danger");
  }
}

async function loadMovimientos() {
  try {
    const params = {
      sortBy: sortColumn,
      sortOrder: sortDirection,
      page: currentPage,
      limit: pageSize,
    };

    if (filterTipo !== "todos") params.type = filterTipo.toUpperCase();
    if (filterCategoria !== "todas") params.category = filterCategoria;
    if (filterFechaDesde) params.startDate = filterFechaDesde;
    if (filterFechaHasta) params.endDate = filterFechaHasta;
    if (filterMontoMin) params.minAmount = filterMontoMin;
    if (filterMontoMax) params.maxAmount = filterMontoMax;
    if (filterConcepto) params.concept = filterConcepto;

    const data = await getTransactions(params);
    movimientos = data.transactions || data;
    pagination = data.pagination || null;

    renderMovimientos();
    renderPagination();
    actualizarBalance();
    actualizarChartGastos();
    actualizarChartMensual();
  } catch (err) {
    console.error("Error loading transactions:", err);
    showToast("Error al cargar movimientos", "danger");
  }
}

async function loadCategorias(tipo) {
  try {
    const params = {};
    if (tipo) params.type = tipo.toUpperCase();
    const data = await getCategories(params);
    categorias = data.categories || [];
    poblarCategoriaFilter();
  } catch (err) {
    console.error("Error loading categories:", err);
  }
}

function getCategoriasPorTipo(tipo) {
  const tipoUpper = tipo === "ingreso" ? "INCOME" : "EXPENSE";
  return categorias
    .filter((c) => c.type === tipoUpper)
    .reduce((acc, c) => {
      acc[c.name] = c.name;
      return acc;
    }, {});
}

function poblarCategorias(tipo, categoriaSeleccionada) {
  const datalist = document.getElementById("categoriaSuggestions");
  if (!datalist) return;
  const tipoUpper = tipo === "ingreso" ? "INCOME" : "EXPENSE";
  datalist.innerHTML = categorias
    .filter((c) => c.type === tipoUpper)
    .map((c) => `<option value="${escapeHTML(c.name)}">`)
    .join("");
  if (categoriaSeleccionada) {
    categoriaInput.value = categoriaSeleccionada;
  }
}

function poblarCategoriaFilter() {
  if (!filterCategoriaSelect) return;

  // Categorías únicas desde los movimientos cargados
  const desdeMovimientos = [
    ...new Set(
      movimientos
        .map((m) => m.category || m.categoria)
        .filter(Boolean),
    ),
  ];

  // Fusionar DB + movimientos, deduplicar
  const todas = [
    ...new Set([
      ...categorias.map((c) => c.name),
      ...desdeMovimientos,
    ]),
  ];

  filterCategoriaSelect.innerHTML =
    '<option value="todas">Todas</option>' +
    todas
      .map((c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`)
      .join("");
}

function renderPagination() {
  if (!pagination || pagination.totalPages <= 1) {
    paginationControls.classList.add("d-none");
    return;
  }

  paginationControls.classList.remove("d-none");
  pageIndicator.textContent = `Página ${pagination.page} de ${pagination.totalPages}`;

  prevPageBtn.classList.toggle("disabled", pagination.page <= 1);
  nextPageBtn.classList.toggle("disabled", pagination.page >= pagination.totalPages);
}

// ============================================================
// RENDER
// ============================================================

function truncarTexto(texto, max = 60) {
  if (!texto) return "";
  if (texto.length <= max) return texto;
  return texto.substring(0, max) + "...";
}

function getEtiquetaCategoria(categoria) {
  if (!categoria) return "";
  const found = categorias.find((c) => c.name === categoria);
  return found ? found.name : categoria;
}

function formatearTipo(tipo) {
  const t = (tipo || "").toLowerCase();
  return t === "income" || t === "ingreso" ? "Ingreso" : "Gasto";
}

function renderMovimientos() {
  document
    .querySelectorAll("th")
    .forEach((th) => th.classList.remove("sorted-asc", "sorted-desc"));

  const thActual = document.querySelector(`th[data-column="${sortColumn}"]`);
  if (thActual) {
    thActual.classList.add(
      sortDirection === "asc" ? "sorted-asc" : "sorted-desc",
    );
  }

  movimientosBody.innerHTML = movimientos
    .map(
      (m) => `
      <tr>
        <td>${escapeHTML(m.date?.split("T")[0] || m.fecha)}</td>
        <td>${escapeHTML(truncarTexto(m.description || m.concepto))}</td>
        <td><span class="type-badge type-${(m.type || m.tipo || '').toLowerCase() === 'income' || (m.type || m.tipo || '').toLowerCase() === 'ingreso' ? 'income' : 'expense'}">${formatearTipo(m.type || m.tipo)}</span></td>
        <td><span class="category-pill">${escapeHTML(getEtiquetaCategoria(m.category || m.categoria))}</span></td>
        <td class="text-end amount-cell ${(m.type || m.tipo || '').toLowerCase() === 'income' || (m.type || m.tipo || '').toLowerCase() === 'ingreso' ? 'amount-income' : 'amount-expense'}">${formatCurrency(m.amount || m.monto)}</td>
        <td>
          <button class="btn-editar" data-id="${escapeHTML(m.id)}">Editar</button>
          <button class="btn-eliminar" data-id="${escapeHTML(m.id)}">Eliminar</button>
        </td>
      </tr>`,
    )
    .join("");
}

function actualizarBalance() {
  const total = movimientos.reduce((acc, m) => {
    const amount = m.amount || m.monto || 0;
    const type = (m.type || m.tipo || "").toLowerCase();
    return type === "income" || type === "ingreso" ? acc + amount : acc - amount;
  }, 0);
  balanceSpan.textContent = `Balance: ${formatCurrency(total)}`;
}

// ============================================================
// CSV EXPORT
// ============================================================

function exportCSV() {
  if (movimientos.length === 0) {
    showToast("No hay movimientos para exportar.", "warning");
    return;
  }

  const lineas = [
    "Fecha;Tipo;Categoría;Concepto;Monto",
    ...movimientos.map((m) => {
      const signo = (m.type || m.tipo || "").toLowerCase() === "income" ? "" : "-";
      return `${m.date?.split("T")[0] || m.fecha};${m.type || m.tipo};${m.category || m.categoria};${m.description || m.concepto};${signo}${m.amount || m.monto}`;
    }),
  ];

  const csv = "\uFEFF" + lineas.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "movimientos.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("CSV exportado correctamente.", "success");
}

document.getElementById("btnExportCSV").addEventListener("click", exportCSV);

// ============================================================
// CANCEL EDIT
// ============================================================

function cancelarEdicion() {
  editandoId = null;
  form.reset();
  fechaInput.value = "";
  tipoSelect.value = "gasto";
  poblarCategorias("gasto");
  formTitle.textContent = "Nuevo Movimiento";
  document.getElementById("addMovimientoBtn").textContent =
    "+ Agregar Movimiento";
  btnCancelEdit.classList.add("d-none");
}

btnCancelEdit.addEventListener("click", cancelarEdicion);

// Update category suggestions when movement type changes
tipoSelect.addEventListener("change", () => {
  poblarCategorias(tipoSelect.value);
});

// ============================================================
// ACCOUNT CRUD
// ============================================================

function cancelAccountEdit() {
  editandoCuentaId = null;
  accountForm.reset();
  accountCurrencyInput.value = "USD";
  accountBalanceInput.value = "";
  accountFormTitle.textContent = "Nueva Cuenta";
  saveAccountBtn.textContent = "Guardar Cuenta";
  cancelAccountEditBtn.classList.add("d-none");
}

cancelAccountEditBtn.addEventListener("click", cancelAccountEdit);

async function renderAccountList() {
  if (accountsTableBody) {
    accountsTableBody.innerHTML = cuentas
      .map(
        (c) => `
        <tr>
          <td>${escapeHTML(c.name)}</td>
          <td>${escapeHTML(c.type)}</td>
          <td>${formatCurrency(Number(c.balance))}</td>
          <td>${escapeHTML(c.currency || "USD")}</td>
          <td>
            <button class="btn-editar btn-edit-account" data-id="${escapeHTML(c.id)}">Editar</button>
            <button class="btn-eliminar btn-delete-account" data-id="${escapeHTML(c.id)}">Eliminar</button>
          </td>
        </tr>`,
      )
      .join("");
  }
}

function toggleManageAccounts() {
  const isHidden = accountManagementRow.classList.contains("d-none");
  accountManagementRow.classList.toggle("d-none", !isHidden);
  accountListRow.classList.toggle("d-none", !isHidden);
  if (isHidden) {
    cancelAccountEdit();
    loadCuentas();
  }
}

btnManageAccounts.addEventListener("click", toggleManageAccounts);

async function handleAccountSubmit(e) {
  e.preventDefault();

  const name = accountNameInput.value.trim();
  const type = accountTypeSelect.value;
  const currency = accountCurrencyInput.value.trim().toUpperCase() || "USD";
  const balanceText = accountBalanceInput.value.trim();
  const balance = balanceText ? Number(balanceText.replace(",", ".")) : 0;

  if (!name) {
    showToast("El nombre de la cuenta es obligatorio.", "warning");
    return;
  }

  const accountData = { name, type, currency, balance };

  try {
    if (editandoCuentaId) {
      // Don't send balance on update unless explicitly changed
      if (!balanceText) delete accountData.balance;
      await updateAccount(editandoCuentaId, accountData);
      showToast("Cuenta actualizada ✓", "success");
    } else {
      await createAccount(accountData);
      showToast("Cuenta creada ✓", "success");
    }

    cancelAccountEdit();
    await loadCuentas();
    // If management section is hidden, just refresh the dropdown silently
  } catch (err) {
    showToast(err.message || "Error al guardar la cuenta", "danger");
  }
}

accountForm.addEventListener("submit", handleAccountSubmit);

// ============================================================
// FORM SUBMIT
// ============================================================

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const concepto = conceptoInput.value.trim();
  const montoTexto = montoInput.value.trim();
  const monto = Number(montoTexto.replace(",", "."));
  const fecha = fechaInput.value;
  const tipo = tipoSelect.value;
  const categoria = categoriaInput.value;

  if (!concepto) {
    showToast("El concepto no puede estar vacío.", "warning");
    return;
  }
  if (!montoTexto || isNaN(monto) || monto <= 0) {
    showToast("Ingresá un monto válido mayor a 0.", "warning");
    return;
  }
  if (!fecha) {
    showToast("Seleccioná una fecha.", "warning");
    return;
  }

  // Auto-create category if it doesn't exist
  const categoriasDelTipo = Object.keys(getCategoriasPorTipo(tipo));
  if (!categoriasDelTipo.includes(categoria)) {
    const tipoUpper = tipo === "ingreso" ? "INCOME" : "EXPENSE";
    try {
      await createCategory({ name: categoria, type: tipoUpper });
      await loadCategorias();
    } catch (err) {
      showToast(`No se pudo crear la categoría "${categoria}".`, "warning");
      return;
    }
  }

  const transactionData = {
    description: concepto,
    amount: monto,
    type: tipo === "gasto" ? "EXPENSE" : "INCOME",
    category: categoria,
    date: new Date(fecha).toISOString(),
    accountId: selectedAccountId || cuentas[0]?.id,
  };

  try {
    if (editandoId) {
      await updateTransaction(editandoId, transactionData);
    } else {
      await createTransaction(transactionData);
    }

    cancelarEdicion();
    currentPage = 1;
    await loadMovimientos();
    showToast(
      editandoId ? "Movimiento actualizado ✓" : "Movimiento agregado ✓",
      "success",
    );
  } catch (err) {
    showToast(err.message || "Error al guardar", "danger");
  }
});

// ============================================================
// TABLE ACTIONS
// ============================================================

movimientosBody.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-editar")) {
    const id = e.target.dataset.id;
    const movimiento = movimientos.find((m) => m.id === id);
    if (!movimiento) return;

    conceptoInput.value = movimiento.description || movimiento.concepto;
    montoInput.value = movimiento.amount || movimiento.monto;
    tipoSelect.value =
      (movimiento.type || movimiento.tipo || "").toLowerCase() === "income"
        ? "ingreso"
        : "gasto";
    poblarCategorias(tipoSelect.value, movimiento.category || movimiento.categoria);
    fechaInput.value = (movimiento.date || movimiento.fecha)?.split("T")[0];
    editandoId = movimiento.id;

    formTitle.textContent = "Editar movimiento";
    document.getElementById("addMovimientoBtn").textContent = "Guardar cambios";
    btnCancelEdit.classList.remove("d-none");
    form.scrollIntoView({ behavior: "smooth" });
  }

  if (e.target.classList.contains("btn-eliminar")) {
    const id = e.target.dataset.id;
    const movimiento = movimientos.find((m) => m.id === id);
    if (!movimiento) return;

    let label = truncarTexto(movimiento.description || movimiento.concepto, 60);

    const confirmado = await showConfirm(`¿Eliminar movimiento "${label}"?`);
    if (!confirmado) return;

    try {
      await deleteTransaction(id);
      if (editandoId === id) cancelarEdicion();
      currentPage = 1;
      await loadMovimientos();
      showToast("Movimiento eliminado.", "success");
    } catch (err) {
      showToast(err.message || "Error al eliminar", "danger");
    }
  }
});

// ============================================================
// ACCOUNT TABLE ACTIONS
// ============================================================

accountsTableBody.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-edit-account")) {
    const id = e.target.dataset.id;
    const cuenta = cuentas.find((c) => c.id === id);
    if (!cuenta) return;

    accountNameInput.value = cuenta.name;
    accountTypeSelect.value = cuenta.type;
    accountCurrencyInput.value = cuenta.currency || "USD";
    accountBalanceInput.value = cuenta.balance;
    editandoCuentaId = cuenta.id;

    accountFormTitle.textContent = "Editar Cuenta";
    saveAccountBtn.textContent = "Guardar Cambios";
    cancelAccountEditBtn.classList.remove("d-none");
    accountManagementRow.classList.remove("d-none");
    accountManagementRow.scrollIntoView({ behavior: "smooth" });
  }

  if (e.target.classList.contains("btn-delete-account")) {
    const id = e.target.dataset.id;
    const cuenta = cuentas.find((c) => c.id === id);
    if (!cuenta) return;

    const confirmado = await showConfirm(
      `¿Eliminar cuenta "${cuenta.name}"? Se eliminarán todos sus movimientos asociados.`,
    );
    if (!confirmado) return;

    try {
      await deleteAccount(id);
      if (editandoCuentaId === id) cancelAccountEdit();
      await loadCuentas();
      showToast("Cuenta eliminada.", "success");
    } catch (err) {
      showToast(err.message || "Error al eliminar la cuenta", "danger");
    }
  }
});

// ============================================================
// PAGINATION
// ============================================================

const prevBtn = prevPageBtn?.querySelector("button");
if (prevBtn) {
  prevBtn.addEventListener("click", () => {
    if (pagination && pagination.page > 1) {
      currentPage = pagination.page - 1;
      loadMovimientos();
    }
  });
}

const nextBtn = nextPageBtn?.querySelector("button");
if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    if (pagination && pagination.page < pagination.totalPages) {
      currentPage = pagination.page + 1;
      loadMovimientos();
    }
  });
}

// ============================================================
// FILTERS
// ============================================================

let filterDebounceTimer = null;

function aplicarFiltros() {
  currentPage = 1;
  loadMovimientos();
}

document.getElementById("filterTipo").addEventListener("change", (e) => {
  filterTipo = e.target.value;
  aplicarFiltros();
});

document.getElementById("filterFechaDesde").addEventListener("change", (e) => {
  filterFechaDesde = e.target.value;
  aplicarFiltros();
});

document.getElementById("filterFechaHasta").addEventListener("change", (e) => {
  filterFechaHasta = e.target.value;
  aplicarFiltros();
});

document.getElementById("filterMontoMin").addEventListener("input", (e) => {
  filterMontoMin = e.target.value;
  aplicarFiltros();
});

document.getElementById("filterMontoMax").addEventListener("input", (e) => {
  filterMontoMax = e.target.value;
  aplicarFiltros();
});

document.getElementById("filterConcepto").addEventListener("input", (e) => {
  filterConcepto = e.target.value;
  clearTimeout(filterDebounceTimer);
  filterDebounceTimer = setTimeout(aplicarFiltros, 300);
});

document.getElementById("filterCategoria").addEventListener("change", (e) => {
  filterCategoria = e.target.value;
  aplicarFiltros();
});

// ============================================================
// SORT
// ============================================================

document.querySelector("thead").addEventListener("click", (e) => {
  const th = e.target.closest("th");
  if (!th || !th.dataset.column) return;

  const column = th.dataset.column;
  // Map frontend columns to API fields
  const columnMap = {
    fecha: "date",
    concepto: "description",
    tipo: "type",
    categoria: "category",
    monto: "amount",
  };

  const previousSortColumn = sortColumn;
  sortColumn = columnMap[column] || column;
  if (sortColumn === previousSortColumn) {
    sortDirection = sortDirection === "asc" ? "desc" : "asc";
  } else {
    sortDirection = "asc";
  }

  currentPage = 1;
  loadMovimientos();
});

// ============================================================
// DARK MODE
// ============================================================

document.getElementById("btnDarkMode").addEventListener("click", () => {
  const oscuro = document.body.classList.toggle("dark-mode");
  document.getElementById("btnDarkMode").textContent = oscuro ? "☀️" : "🌙";

  const textColor = oscuro ? "#e0e0e0" : "#666";
  const gridColor = oscuro ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

  if (chartGastos) {
    chartGastos.options.color = textColor;
    chartGastos.update();
  }
  if (chartMensual) {
    const incomeBg = oscuro
      ? "rgba(76, 175, 80, 0.7)"
      : "rgba(40, 167, 69, 0.7)";
    const incomeBorder = oscuro ? "#4caf50" : "#28a745";
    const expenseBg = oscuro
      ? "rgba(255, 107, 107, 0.7)"
      : "rgba(220, 53, 69, 0.7)";
    const expenseBorder = oscuro ? "#ff6b6b" : "#dc3545";

    chartMensual.options.color = textColor;
    chartMensual.options.scales.x.grid.color = gridColor;
    chartMensual.options.scales.y.grid.color = gridColor;
    chartMensual.data.datasets[0].backgroundColor = incomeBg;
    chartMensual.data.datasets[0].borderColor = incomeBorder;
    chartMensual.data.datasets[1].backgroundColor = expenseBg;
    chartMensual.data.datasets[1].borderColor = expenseBorder;
    chartMensual.update();
  }
});

// ============================================================
// CSV IMPORT
// ============================================================

const fileInput = document.getElementById("fileInput");
const btnImportCSV = document.getElementById("btnImportCSV");

btnImportCSV.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();

  lector.onload = async (evento) => {
    const contenido = evento.target.result;
    const resultado = parsearCSV(contenido);

    if (resultado.movimientos.length === 0) {
      showToast(
        "No se pudo importar ningún movimiento. Revisá el formato del archivo.",
        "danger",
      );
      fileInput.value = "";
      return;
    }

    try {
      const transactions = resultado.movimientos.map((m) => ({
        description: m.concepto,
        amount: m.monto,
        type: m.tipo === "ingreso" ? "INCOME" : "EXPENSE",
        category: m.categoria,
        date: new Date(m.fecha).toISOString(),
        accountId: selectedAccountId || cuentas[0]?.id,
      }));

      await bulkCreateTransactions(transactions);
      currentPage = 1;
      await loadMovimientos();
      fileInput.value = "";

      const msg = `${resultado.movimientos.length} movimiento(s) importado(s)`;
      if (resultado.errores.length > 0) {
        showToast(
          `${msg}. ${resultado.errores.length} línea(s) con errores (omitidas).`,
          "warning",
        );
      } else {
        showToast(`✅ ${msg}`, "success");
      }
    } catch (err) {
      showToast(err.message || "Error al importar", "danger");
    }
  };

  lector.onerror = () => {
    showToast("Error al leer el archivo.", "danger");
    fileInput.value = "";
  };

  lector.readAsText(archivo, "UTF-8");
});

function parsearCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  const errores = [];

  if (lineas.length > 0) {
    lineas[0] = lineas[0].replace(/^\uFEFF/, "");
  }

  const movimientosNuevos = lineas.slice(1).reduce((acc, linea, idx) => {
    const numLinea = idx + 2;
    const partes = linea.split(";");

    if (partes.length < 5) {
      errores.push({ linea: numLinea, razon: "Faltan columnas" });
      return acc;
    }

    const [fecha, tipoRaw, categoria, concepto, montoStr] = partes;
    const tipo = tipoRaw.trim().toLowerCase();
    const categoriaLimpia = categoria.trim().toLowerCase();

    if (!fecha || !tipo || !concepto) {
      errores.push({ linea: numLinea, razon: "Campos obligatorios vacíos" });
      return acc;
    }

    if (tipo !== "ingreso" && tipo !== "gasto") {
      errores.push({ linea: numLinea, razon: `Tipo inválido: "${tipoRaw}"` });
      return acc;
    }

    const monto = Math.abs(Number(montoStr.replace(",", ".")));
    if (!monto || monto <= 0) {
      errores.push({ linea: numLinea, razon: `Monto inválido: "${montoStr}"` });
      return acc;
    }

    return [
      ...acc,
      {
        concepto: concepto.trim(),
        monto,
        tipo,
        categoria: categoriaLimpia,
        fecha: fecha.trim(),
      },
    ];
  }, []);

  return { movimientos: movimientosNuevos, errores };
}

// ============================================================
// CHARTS
// ============================================================

let chartGastos = null;
let chartMensual = null;

function actualizarChartGastos() {
  const gastosPorCategoria = movimientos
    .filter((m) => (m.type || m.tipo || "").toLowerCase() === "expense")
    .reduce(
      (acc, m) => ({
        ...acc,
        [m.category || m.categoria]:
          (acc[m.category || m.categoria] || 0) + (m.amount || m.monto),
      }),
      {},
    );

  const labels = Object.keys(gastosPorCategoria).map(getEtiquetaCategoria);
  const data = Object.values(gastosPorCategoria);

  // Palette profesional — matchea el theme indigo/purple
  const PALETTE = [
    "#667eea", "#764ba2", "#a855f7", "#7c3aed", "#8b9aff",
    "#6366f1", "#6d28d9", "#c084fc", "#818cf8", "#4338ca",
  ];
  let colorIdx = 0;

  const backgroundColor = Object.keys(gastosPorCategoria).map((catName) => {
    // Usar el color de la categoría en DB si existe
    const dbCat = categorias.find(
      (c) => c.name === catName || c.id === catName,
    );
    if (dbCat?.color) return dbCat.color;
    // Sino, asignar del palette rotativo
    return PALETTE[colorIdx++ % PALETTE.length];
  });

  if (chartGastos) {
    chartGastos.data.labels = labels;
    chartGastos.data.datasets[0].data = data;
    chartGastos.data.datasets[0].backgroundColor = backgroundColor;
    chartGastos.update();
    return;
  }

  chartGastos = new Chart(document.getElementById("chartGastos"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      color: document.body.classList.contains("dark-mode") ? "#c0c0c0" : "#666",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyle: "circle",
            font: {
              family: "'Segoe UI', Tahoma, sans-serif",
              size: 12,
            },
          },
        },
      },
    },
  });
}

// ============================================================
// MONTHLY COMPARISON CHART
// ============================================================

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function actualizarChartMensual() {
  getDashboardMonthly()
    .then((data) => {
      const monthlyData = data.monthlyData || [];

      const labels = monthlyData.map(
        (m) => `${MONTHS_ES[m.month - 1]} ${m.year}`,
      );
      const incomeData = monthlyData.map((m) => m.income);
      const expensesData = monthlyData.map((m) => m.expenses);

      const oscuro = document.body.classList.contains("dark-mode");
      const textColor = oscuro ? "#e0e0e0" : "#666";
      const gridColor = oscuro
        ? "rgba(255,255,255,0.1)"
        : "rgba(0,0,0,0.1)";
      const incomeBg = oscuro
        ? "rgba(76, 175, 80, 0.7)"
        : "rgba(40, 167, 69, 0.7)";
      const incomeBorder = oscuro ? "#4caf50" : "#28a745";
      const expenseBg = oscuro
        ? "rgba(255, 107, 107, 0.7)"
        : "rgba(220, 53, 69, 0.7)";
      const expenseBorder = oscuro ? "#ff6b6b" : "#dc3545";

      if (chartMensual) {
        chartMensual.data.labels = labels;
        chartMensual.data.datasets[0].data = incomeData;
        chartMensual.data.datasets[1].data = expensesData;
        chartMensual.data.datasets[0].backgroundColor = incomeBg;
        chartMensual.data.datasets[0].borderColor = incomeBorder;
        chartMensual.data.datasets[1].backgroundColor = expenseBg;
        chartMensual.data.datasets[1].borderColor = expenseBorder;
        chartMensual.options.color = textColor;
        chartMensual.options.scales.x.grid.color = gridColor;
        chartMensual.options.scales.y.grid.color = gridColor;
        chartMensual.update();
        return;
      }

      chartMensual = new Chart(document.getElementById("chartMensual"), {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              label: "Ingresos",
              data: incomeData,
              backgroundColor: incomeBg,
              borderColor: incomeBorder,
              borderWidth: 1,
              borderRadius: 4,
              barPercentage: 0.65,
            },
            {
              label: "Gastos",
              data: expensesData,
              backgroundColor: expenseBg,
              borderColor: expenseBorder,
              borderWidth: 1,
              borderRadius: 4,
              barPercentage: 0.65,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          color: textColor,
          scales: {
            x: {
              grid: { color: gridColor, display: false },
              ticks: {
                font: {
                  family: "'Segoe UI', Tahoma, sans-serif",
                  size: 11,
                },
              },
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: {
                font: {
                  family: "'Segoe UI', Tahoma, sans-serif",
                  size: 11,
                },
              },
            },
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                padding: 16,
                usePointStyle: true,
                pointStyle: "circle",
                font: {
                  family: "'Segoe UI', Tahoma, sans-serif",
                  size: 12,
                },
              },
            },
          },
        },
      });
    })
    .catch((err) => {
      console.error("Error loading monthly data:", err);
    });
}

// ============================================================
// INIT
// ============================================================

window.addEventListener("auth:ready", async () => {
  await loadCuentas();
  await loadCategorias();
  // Poblar select de categorías en presupuestos
  poblarBudgetCategorias(categorias);
  await loadMovimientos();
  await loadBudgets();
  await loadGroups();
  // Refrescar filtro con categorías de movimientos ya cargados
  poblarCategoriaFilter();
});
