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
} from "./api.js";
import { loadBudgets } from "./budgets.js";
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

// ============================================================
// CATEGORIES - el usuario ingresa la categoria como texto libre.
// No hay lista fija ni validacion contra set predefinido.
// ============================================================

// ============================================================
// STATE
// ============================================================

let movimientos = [];
let cuentas = [];
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
// TOAST & CONFIRM
// ============================================================

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

// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
    actualizarChartEvolucion();
    actualizarChartMensual();
  } catch (err) {
    console.error("Error loading transactions:", err);
    showToast("Error al cargar movimientos", "danger");
  }
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

function getEtiquetaCategoria(categoria) {
  return (
    CATEGORIAS_GASTO[categoria] || CATEGORIAS_INGRESO[categoria] || categoria
  );
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(amount);
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
        <td>${escapeHTML(m.description || m.concepto)}</td>
        <td>${escapeHTML((m.type || m.tipo)?.toLowerCase())}</td>
        <td>${escapeHTML(getEtiquetaCategoria(m.category || m.categoria))}</td>
        <td>${formatCurrency(m.amount || m.monto)}</td>
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
  const categoria = categoriaSelect.value;

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

  const categoriasDelTipo = Object.keys(getCategoriasPorTipo(tipo));
  if (!categoriasDelTipo.includes(categoria)) {
    showToast(
      "Seleccioná una categoría válida para este tipo de movimiento.",
      "warning",
    );
    return;
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

    let label = movimiento.description || movimiento.concepto;
    if (label.length > 60) label = label.substring(0, 60) + "...";

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

prevPageBtn.querySelector("button").addEventListener("click", () => {
  if (pagination && pagination.page > 1) {
    currentPage = pagination.page - 1;
    loadMovimientos();
  }
});

nextPageBtn.querySelector("button").addEventListener("click", () => {
  if (pagination && pagination.page < pagination.totalPages) {
    currentPage = pagination.page + 1;
    loadMovimientos();
  }
});

// ============================================================
// FILTERS
// ============================================================

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
  aplicarFiltros();
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

  sortColumn = columnMap[column] || column;
  if (sortColumn === column) {
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
  if (chartEvolucion) {
    chartEvolucion.options.color = textColor;
    chartEvolucion.options.scales.x.grid.color = gridColor;
    chartEvolucion.options.scales.y.grid.color = gridColor;
    chartEvolucion.update();
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

    const categoriasValidasDelTipo = Object.keys(getCategoriasPorTipo(tipo));
    if (!categoriasValidasDelTipo.includes(categoriaLimpia)) {
      errores.push({
        linea: numLinea,
        razon: `Categoría "${categoria}" no válida para tipo "${tipo}"`,
      });
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
let chartEvolucion = null;
let chartMensual = null;

function actualizarChartGastos() {
  const categorias = movimientos
    .filter((m) => (m.type || m.tipo || "").toLowerCase() === "expense")
    .reduce(
      (acc, m) => ({
        ...acc,
        [m.category || m.categoria]:
          (acc[m.category || m.categoria] || 0) + (m.amount || m.monto),
      }),
      {},
    );

  const labels = Object.keys(categorias).map(getEtiquetaCategoria);
  const data = Object.values(categorias);
  const colores = {
    alimentacion: "#ff6384",
    transporte: "#36a2eb",
    entretenimiento: "#ffce56",
    salud: "#4bc0c0",
    housing: "#9966ff",
    utilities: "#ff9f40",
    "otros-gasto": "#c9cbcf",
  };

  const backgroundColor = Object.keys(categorias).map(
    (c) => colores[c] || "#cccccc",
  );

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
      color: "#666",
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });
}

function actualizarChartEvolucion() {
  const ordenados = [...movimientos].sort(
    (a, b) => new Date(a.date || a.fecha) - new Date(b.date || b.fecha),
  );

  const { labels, data } = ordenados.reduce(
    (acc, m) => {
      const amount = m.amount || m.monto;
      const type = (m.type || m.tipo || "").toLowerCase();
      const delta = type === "income" || type === "ingreso" ? amount : -amount;
      const acumulado = acc.acumulado + delta;
      return {
        labels: [...acc.labels, (m.date || m.fecha)?.split("T")[0]],
        data: [...acc.data, acumulado],
        acumulado,
      };
    },
    { labels: [], data: [], acumulado: 0 },
  );

  const oscuro = document.body.classList.contains("dark-mode");
  const textColor = oscuro ? "#e0e0e0" : "#666";
  const gridColor = oscuro ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";

  if (chartEvolucion) {
    chartEvolucion.data.labels = labels;
    chartEvolucion.data.datasets[0].data = data;
    chartEvolucion.options.color = textColor;
    chartEvolucion.options.scales.x.grid.color = gridColor;
    chartEvolucion.options.scales.y.grid.color = gridColor;
    chartEvolucion.update();
    return;
  }

  chartEvolucion = new Chart(document.getElementById("chartEvolucion"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Balance (€)",
          data,
          borderColor: "#667eea",
          backgroundColor: "rgba(102, 126, 234, 0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "#667eea",
        },
      ],
    },
    options: {
      responsive: true,
      color: textColor,
      scales: {
        x: {
          ticks: { maxTicksLimit: 10 },
          grid: { color: gridColor },
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
        },
      },
      plugins: {
        legend: { display: false },
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
            },
            {
              label: "Gastos",
              data: expensesData,
              backgroundColor: expenseBg,
              borderColor: expenseBorder,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          color: textColor,
          scales: {
            x: {
              grid: { color: gridColor },
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
            },
          },
          plugins: {
            legend: { position: "bottom" },
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
  await loadMovimientos();
  await loadBudgets();
  await loadGroups();
});
