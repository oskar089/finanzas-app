// ============================================================
// [DEPRECATED] Este archivo (app.js) es la implementación LEGACY
// que usaba localStorage para persistencia local del lado del
// cliente. Fue reemplazado por js/app.js (ES module) que se
// comunica con la API REST del backend.
//
// Este archivo se conserva como referencia pero ya NO se carga
// desde index.html. Los nuevos cambios deben hacerse en js/app.js.
// ============================================================

const form = document.getElementById("addMovementForm");
const conceptoInput = document.getElementById("concepto");
const montoInput = document.getElementById("monto");
const tipoSelect = document.getElementById("tipo");
const categoriaSelect = document.getElementById("categoria");
const fechaInput = document.getElementById("fecha");
const movimientosBody = document.getElementById("movimientosTableBody");
const balanceSpan = document.getElementById("totalBalance");
const btnCancelEdit = document.getElementById("btnCancelEdit");
const formTitle = document.getElementById("formTitle");

// Categorías separadas por tipo. AGENTS.md: "Input validation before processing"
// — antes había una sola lista fija sin distinguir ingreso/gasto, lo que permitía
// categorizar un ingreso como "Alimentación".
const CATEGORIAS_GASTO = {
  alimentacion: "Alimentación",
  transporte: "Transporte",
  entretenimiento: "Entretenimiento",
  salud: "Salud",
  "otros-gasto": "Otros",
};

const CATEGORIAS_INGRESO = {
  sueldo: "Sueldo",
  freelance: "Freelance",
  inversiones: "Inversiones",
  "otros-ingreso": "Otros",
};

function getCategoriasPorTipo(tipo) {
  return tipo === "ingreso" ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO;
}

function getCategoriasValidas() {
  return [...Object.keys(CATEGORIAS_GASTO), ...Object.keys(CATEGORIAS_INGRESO)];
}

// Repuebla el <select> de categoría según el tipo (gasto/ingreso) seleccionado.
function poblarCategorias(tipo, valorPreseleccionado = null) {
  const categorias = getCategoriasPorTipo(tipo);
  categoriaSelect.innerHTML = Object.entries(categorias)
    .map(([valor, etiqueta]) => `<option value="${valor}">${etiqueta}</option>`)
    .join("");
  if (valorPreseleccionado && categorias[valorPreseleccionado]) {
    categoriaSelect.value = valorPreseleccionado;
  }
}

tipoSelect.addEventListener("change", (e) => poblarCategorias(e.target.value));
poblarCategorias(tipoSelect.value);

let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let sortColumn = "fecha";
let sortDirection = "desc";
let filterTipo = "todos";
let filterCategoria = "todas";
let filterFechaDesde = "";
let filterFechaHasta = "";
let filterMontoMin = "";
let filterMontoMax = "";
let filterConcepto = "";
let successAlertTimer = null;
let editandoId = null;
renderMovimientos();
actualizarBalance();

// AGENTS.md: "Input validation before processing"
// Escapa caracteres que rompen innerHTML cuando el dato viene de un CSV importado
// o de cualquier input del usuario.
function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================
// TOAST Y CONFIRM — reemplazan alert()/confirm() nativos
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
// PERSISTENCIA — con manejo de errores
// ============================================================

// AGENTS.md: "Input validation before processing"
// Antes localStorage.setItem se llamaba sin try/catch en 4 sitios distintos.
// Si la cuota está llena o el navegador está en modo incógnito restrictivo,
// la operación lanza una excepción y la app fallaba silenciosamente.
function guardarMovimientos() {
  try {
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    return true;
  } catch (err) {
    showToast(
      "No se pudo guardar: almacenamiento lleno o bloqueado.",
      "danger",
    );
    console.error("Error guardando en localStorage:", err);
    return false;
  }
}

//Funcion que devuelve los movimientos filtrados segun los filtros aplicados
function getMovimientosFiltrados() {
  return movimientos.filter((m) => {
    if (filterTipo !== "todos" && m.tipo !== filterTipo) return false;
    if (filterCategoria !== "todas" && m.categoria !== filterCategoria)
      return false;
    if (filterFechaDesde && m.fecha < filterFechaDesde) return false;
    if (filterFechaHasta && m.fecha > filterFechaHasta) return false;
    if (filterMontoMin && m.monto < Number(filterMontoMin)) return false;
    if (filterMontoMax && m.monto > Number(filterMontoMax)) return false;
    if (
      filterConcepto &&
      !m.concepto.toLowerCase().includes(filterConcepto.toLowerCase().trim())
    )
      return false;
    return true;
  });
}

// AGENTS.md: "Immutable patterns (spread, map, filter)"
function ordenarMovimientos(columna) {
  if (sortColumn === columna) {
    sortDirection = sortDirection === "asc" ? "desc" : "asc";
  } else {
    sortColumn = columna;
    sortDirection = "asc";
  }

  movimientos = [...movimientos].sort((a, b) => {
    const valorA = a[columna];
    const valorB = b[columna];

    if (columna === "monto") {
      return sortDirection === "asc" ? valorA - valorB : valorB - valorA;
    }
    if (typeof valorA === "string") {
      return sortDirection === "asc" ?
          valorA.localeCompare(valorB)
        : valorB.localeCompare(valorA);
    }
    return sortDirection === "asc" ? valorA - valorB : valorB - valorA;
  });
}

// Devuelve la etiqueta legible de una categoría (ej: "otros-gasto" → "Otros")
function getEtiquetaCategoria(categoria) {
  return (
    CATEGORIAS_GASTO[categoria] || CATEGORIAS_INGRESO[categoria] || categoria
  );
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

  const filtrados = getMovimientosFiltrados();

  movimientosBody.innerHTML = filtrados
    .map(
      (movimiento) => `
      <tr>
        <td>${escapeHTML(movimiento.fecha)}</td>
        <td>${escapeHTML(movimiento.concepto)}</td>
        <td>${escapeHTML(movimiento.tipo)}</td>
        <td>${escapeHTML(getEtiquetaCategoria(movimiento.categoria))}</td>
        <td>€${escapeHTML(movimiento.monto)}</td>
        <td>
          <button class="btn-editar" data-id="${escapeHTML(movimiento.id)}">Editar</button>
          <button class="btn-eliminar" data-id="${escapeHTML(movimiento.id)}">Eliminar</button>
        </td>
      </tr>`,
    )
    .join("");
}

function actualizarBalance() {
  const total = movimientos.reduce(
    (acc, m) => (m.tipo === "ingreso" ? acc + m.monto : acc - m.monto),
    0,
  );
  balanceSpan.textContent = `Balance: €${total.toFixed(2)}`;
}

function exportCSV() {
  if (movimientos.length === 0) {
    showToast("No hay movimientos para exportar.", "warning");
    return;
  }

  const lineas = [
    "Fecha;Tipo;Categoría;Concepto;Monto",
    ...movimientos.map((m) => {
      const signo = m.tipo === "ingreso" ? "" : "-";
      return `${m.fecha};${m.tipo};${m.categoria};${m.concepto};${signo}${m.monto}`;
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

// Restaura el formulario a su estado "Nuevo movimiento", limpiando cualquier edición pendiente.
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

form.addEventListener("submit", (e) => {
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
  // Valida la categoría contra el set correcto según el tipo elegido,
  // no contra una lista global. Evita que un ingreso quede con categoría de gasto.
  const categoriasDelTipo = Object.keys(getCategoriasPorTipo(tipo));
  if (!categoriasDelTipo.includes(categoria)) {
    showToast(
      "Seleccioná una categoría válida para este tipo de movimiento.",
      "warning",
    );
    return;
  }

  if (editandoId) {
    movimientos = movimientos.map((m) =>
      m.id === editandoId ?
        { ...m, concepto, monto, tipo, categoria, fecha }
      : m,
    );
  } else {
    const nuevoMovimiento = {
      id: crypto.randomUUID(),
      concepto,
      monto,
      tipo,
      categoria,
      fecha,
    };
    movimientos = [...movimientos, nuevoMovimiento];
  }

  if (!guardarMovimientos()) return;

  const fueEdicion = Boolean(editandoId);
  cancelarEdicion();
  renderMovimientos();
  actualizarBalance();
  actualizarChartGastos();
  actualizarChartEvolucion();
  showToast(
    fueEdicion ? "Movimiento actualizado ✓" : "Movimiento agregado ✓",
    "success",
  );
});

movimientosBody.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-editar")) {
    const id = e.target.dataset.id;
    const movimiento = movimientos.find((m) => m.id === id);
    if (!movimiento) return;

    conceptoInput.value = movimiento.concepto;
    montoInput.value = movimiento.monto;
    tipoSelect.value = movimiento.tipo;
    poblarCategorias(movimiento.tipo, movimiento.categoria);
    fechaInput.value = movimiento.fecha;
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

    let label = movimiento.concepto;
    if (label.length > 60) label = label.substring(0, 60) + "...";

    const confirmado = await showConfirm(`¿Eliminar movimiento "${label}"?`);
    if (!confirmado) return;

    movimientos = movimientos.filter((m) => m.id !== id);
    if (!guardarMovimientos()) return;

    // Si se borró el movimiento que se estaba editando, limpiar el formulario.
    if (editandoId === id) cancelarEdicion();

    renderMovimientos();
    actualizarBalance();
    actualizarChartGastos();
    actualizarChartEvolucion();
    showToast("Movimiento eliminado.", "success");
  }
});

function aplicarFiltros() {
  renderMovimientos();
  actualizarBalance();
  actualizarChartGastos();
  actualizarChartEvolucion();
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

document.querySelector("thead").addEventListener("click", (e) => {
  const th = e.target.closest("th");
  if (!th || !th.dataset.column) return;

  ordenarMovimientos(th.dataset.column);
  renderMovimientos();
  actualizarBalance();
  actualizarChartGastos();
  actualizarChartEvolucion();
});

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
});

// ============================================================
// IMPORTAR CSV
// ============================================================

const fileInput = document.getElementById("fileInput");
const btnImportCSV = document.getElementById("btnImportCSV");

btnImportCSV.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();

  lector.onload = (evento) => {
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

    movimientos = [...movimientos, ...resultado.movimientos];
    if (!guardarMovimientos()) {
      fileInput.value = "";
      return;
    }

    renderMovimientos();
    actualizarBalance();
    actualizarChartGastos();
    actualizarChartEvolucion();
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
  };

  lector.onerror = () => {
    showToast("Error al leer el archivo.", "danger");
    fileInput.value = "";
  };

  lector.readAsText(archivo, "UTF-8");
});

/**
 * Parsea contenido CSV y devuelve movimientos válidos + errores.
 * Formato esperado: Fecha;Tipo;Categoría;Concepto;Monto
 *
 * Valida la categoría contra el set correspondiente al tipo de cada línea
 * (no una lista global), igual que en el formulario de alta.
 */
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
        id: crypto.randomUUID(),
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
// GRÁFICO DE GASTOS POR CATEGORÍA
// ============================================================

let chartGastos = null;

function actualizarChartGastos() {
  const categorias = movimientos
    .filter((m) => m.tipo === "gasto")
    .reduce(
      (acc, m) => ({
        ...acc,
        [m.categoria]: (acc[m.categoria] || 0) + m.monto,
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
    "otros-gasto": "#9966ff",
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

// ============================================================
// GRÁFICO DE EVOLUCIÓN DEL BALANCE
// ============================================================

let chartEvolucion = null;

function actualizarChartEvolucion() {
  const ordenados = [...movimientos].sort(
    (a, b) => new Date(a.fecha) - new Date(b.fecha),
  );

  const { labels, data } = ordenados.reduce(
    (acc, m) => {
      const delta = m.tipo === "ingreso" ? m.monto : -m.monto;
      const acumulado = acc.acumulado + delta;
      return {
        labels: [...acc.labels, m.fecha],
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

actualizarChartGastos();
actualizarChartEvolucion();
