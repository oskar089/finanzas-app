const form = document.getElementById("addMovementForm");
const conceptoInput = document.getElementById("concepto");
const montoInput = document.getElementById("monto");
const tipoSelect = document.getElementById("tipo");
const categoriaSelect = document.getElementById("categoria");
const fechaInput = document.getElementById("fecha");
const movimientosBody = document.getElementById("movimientosTableBody");
const balanceSpan = document.getElementById("totalBalance");

let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let sortColumn = "fecha";
let sortDirection = "desc";
let filterTipo = "todos";
let filterCategoria = "todas";
let filterFechaDesde = "";
let filterFechaHasta = "";
let filterMontoMax = "";
let filterConcepto = "";
let successAlertTimer = null;
let editandoId = null;
renderMovimientos();
actualizarBalance();

//Funcion que devuelve los movimientos filtrados segun los filtros aplicados
function getMovimientosFiltrados() {
  return movimientos.filter((m) => {
    // Filtro por tipo
    if (filterTipo !== "todos" && m.tipo !== filterTipo) return false;

    // Filtro por categoría
    if (filterCategoria !== "todas" && m.categoria !== filterCategoria)
      return false;

    // Filtro por fecha desde
    if (filterFechaDesde && m.fecha < filterFechaDesde) return false;

    // Filtro por fecha hasta
    if (filterFechaHasta && m.fecha > filterFechaHasta) return false;

    // Filtro por monto máximo
    if (filterMontoMax && m.monto > Number(filterMontoMax)) return false;

    // Filtro por concepto
    if (
      filterConcepto &&
      !m.concepto.toLowerCase().includes(filterConcepto.toLowerCase().trim())
    )
      return false;

    return true;
  });
}

function ordenarMovimientos(columna) {
  if (sortColumn === columna) {
    sortDirection = sortDirection === "asc" ? "desc" : "asc";
  } else {
    sortColumn = columna;
    sortDirection = "asc";
  }
  movimientos.sort((a, b) => {
    let valorA = a[columna];
    let valorB = b[columna];

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

function renderMovimientos() {
  movimientosBody.innerHTML = "";

  // Limpiar clase de todos los th
  document
    .querySelectorAll("th")
    .forEach((th) => th.classList.remove("sorted-asc", "sorted-desc"));

  // Poner clase al th activo
  const thActual = document.querySelector(`th[data-column="${sortColumn}"]`);
  if (thActual) {
    thActual.classList.add(
      sortDirection === "asc" ? "sorted-asc" : "sorted-desc",
    );
  }

  const filtrados = getMovimientosFiltrados();
  for (let i = 0; i < filtrados.length; i++) {
    const movimiento = filtrados[i];
    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${movimiento.fecha}</td>
      <td>${movimiento.concepto}</td>
      <td>${movimiento.tipo}</td>
      <td>${movimiento.categoria}</td>
      <td>€${movimiento.monto}</td>
      <td>
        <button class="btn-editar" data-id="${movimiento.id}">Editar</button>
        <button class="btn-eliminar" data-id="${movimiento.id}">Eliminar</button>
      </td>
    `;

    movimientosBody.appendChild(fila);
  }
}

function actualizarBalance() {
  let total = 0;

  for (let i = 0; i < movimientos.length; i++) {
    if (movimientos[i].tipo === "ingreso") {
      total += movimientos[i].monto;
    } else {
      total -= movimientos[i].monto;
    }
  }
  balanceSpan.textContent = `Balance: €${total.toFixed(2)}`;
}

function exportCSV() {
  if (movimientos.length === 0) {
    alert("No hay movimientos para exportar.");
    return;
  }

  const lineas = ["Fecha;Tipo;Categoría;Concepto;Monto"];

  for (let i = 0; i < movimientos.length; i++) {
    const m = movimientos[i];
    const signo = m.tipo === "ingreso" ? "" : "-";
    lineas.push(
      `${m.fecha};${m.tipo};${m.categoria};${m.concepto};${signo}${m.monto}`,
    );
  }

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
}

document.getElementById("btnExportCSV").addEventListener("click", exportCSV);

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const concepto = conceptoInput.value.trim();
  const montoTexto = montoInput.value.trim();
  const monto = Number(montoTexto.replace(",", "."));
  const fecha = fechaInput.value;

  // Validación
  if (!concepto) {
    alert("El concepto no puede estar vacío.");
    return;
  }
  if (!montoTexto || isNaN(monto) || monto <= 0) {
    alert("Ingresá un monto válido mayor a 0.");
    return;
  }
  if (!fecha) {
    alert("Seleccioná una fecha.");
    return;
  }

  let nuevoMovimiento;

  if (editandoId) {
    // === MODO EDICIÓN ===
    nuevoMovimiento = movimientos.find((m) => m.id === editandoId);
    nuevoMovimiento.concepto = concepto;
    nuevoMovimiento.monto = monto;
    nuevoMovimiento.tipo = tipoSelect.value;
    nuevoMovimiento.categoria = categoriaSelect.value;
    nuevoMovimiento.fecha = fecha;
    editandoId = null;
  } else {
    // === MODO NUEVO ===
    nuevoMovimiento = {
      id: Date.now(),
      concepto,
      monto,
      tipo: tipoSelect.value,
      categoria: categoriaSelect.value,
      fecha,
    };
    movimientos.push(nuevoMovimiento);
  }

  localStorage.setItem("movimientos", JSON.stringify(movimientos));
  form.reset();
  document.getElementById("addMovimientoBtn").textContent = "+ Agregar Movimiento";
  renderMovimientos();
  actualizarBalance();
  actualizarChartGastos();
  actualizarChartEvolucion();

  // Alerta de éxito
  if (successAlertTimer) clearTimeout(successAlertTimer);
  const formCardBody = form.parentElement;
  const oldAlert = formCardBody.querySelector(".alert-success");
  if (oldAlert) oldAlert.remove();

  const alertDiv = document.createElement("div");
  alertDiv.className = "alert alert-success";
  alertDiv.textContent = "Movimiento agregado ✓";
  formCardBody.insertBefore(alertDiv, formCardBody.firstChild);
  successAlertTimer = setTimeout(() => {
    alertDiv.remove();
    successAlertTimer = null;
  }, 3000);
});

movimientosBody.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-editar")) {
    const id = Number(e.target.dataset.id);
    const movimiento = movimientos.find((m) => m.id === id);
    if (!movimiento) return;
    conceptoInput.value = movimiento.concepto;
    montoInput.value = movimiento.monto;
    tipoSelect.value = movimiento.tipo;
    categoriaSelect.value = movimiento.categoria;
    fechaInput.value = movimiento.fecha;
    editandoId = movimiento.id;
    document.getElementById("addMovimientoBtn").textContent = "Guardar cambios";
  }
  if (e.target.classList.contains("btn-eliminar")) {
    const id = Number(e.target.dataset.id);
    const movimiento = movimientos.find((m) => m.id === id);
    if (!movimiento) return;
    let label = movimiento.concepto;
    if (label.length > 60) label = label.substring(0, 60) + "...";
    if (!confirm(`¿Eliminar movimiento "${label}"?`)) return;
    movimientos = movimientos.filter((m) => m.id !== id);
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    renderMovimientos();
    actualizarBalance();
    actualizarChartGastos();
    actualizarChartEvolucion();
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

// El botón solo dispara el input oculto
btnImportCSV.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();

  lector.onload = (evento) => {
    const contenido = evento.target.result;
    const resultado = parsearCSV(contenido);

    if (resultado.movimientos.length === 0) {
      alert("No se pudo importar ningún movimiento. Revisá el formato del archivo.");
      fileInput.value = "";
      return;
    }

    // Agregar los nuevos movimientos al array existente
    movimientos.push(...resultado.movimientos);
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    renderMovimientos();
    actualizarBalance();
    actualizarChartGastos();
    actualizarChartEvolucion();
    fileInput.value = ""; // limpia para permitir re-seleccionar el mismo archivo

    // Mostrar resumen
    const msg = `✅ ${resultado.movimientos.length} movimiento(s) importado(s)`;
    if (resultado.errores.length > 0) {
      alert(`${msg}\n⚠️ ${resultado.errores.length} línea(s) con errores (se omitieron)`);
    } else {
      alert(msg);
    }
  };

  lector.onerror = () => {
    alert("Error al leer el archivo.");
    fileInput.value = "";
  };

  lector.readAsText(archivo, "UTF-8");
});

/**
 * Parsea contenido CSV y devuelve movimientos válidos + errores.
 * Formato esperado: Fecha;Tipo;Categoría;Concepto;Monto
 */
function parsearCSV(texto) {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  const movimientosNuevos = [];
  const errores = [];

  // Si hay BOM (marca de orden de bytes UTF-8), lo sacamos
  if (lineas.length > 0) {
    lineas[0] = lineas[0].replace(/^\uFEFF/, "");
  }

  for (let i = 1; i < lineas.length; i++) {
    const partes = lineas[i].split(";");

    if (partes.length < 5) {
      errores.push({ linea: i + 1, razon: "Faltan columnas" });
      continue;
    }

    const [fecha, tipo, categoria, concepto, montoStr] = partes;

    if (!fecha || !tipo || !concepto) {
      errores.push({ linea: i + 1, razon: "Campos obligatorios vacíos" });
      continue;
    }

    // El monto puede venir con signo (-2.70) o sin él (2.70)
    const monto = Math.abs(Number(montoStr.replace(",", ".")));
    if (!monto || monto <= 0) {
      errores.push({ linea: i + 1, razon: `Monto inválido: "${montoStr}"` });
      continue;
    }

    movimientosNuevos.push({
      id: Date.now() + i,
      concepto: concepto.trim(),
      monto,
      tipo: tipo.trim().toLowerCase(),
      categoria: categoria.trim().toLowerCase(),
      fecha: fecha.trim(),
    });
  }

  return { movimientos: movimientosNuevos, errores };
}

// ============================================================
// GRÁFICO DE GASTOS POR CATEGORÍA
// ============================================================

let chartGastos = null;

function actualizarChartGastos() {
  const gastos = movimientos.filter((m) => m.tipo === "gasto");
  const categorias = {};
  for (let i = 0; i < gastos.length; i++) {
    const cat = gastos[i].categoria;
    categorias[cat] = (categorias[cat] || 0) + gastos[i].monto;
  }

  const labels = Object.keys(categorias);
  const data = Object.values(categorias);
  const colores = {
    alimentacion: "#ff6384",
    transporte: "#36a2eb",
    entretenimiento: "#ffce56",
    salud: "#4bc0c0",
    otros: "#9966ff",
  };

  if (chartGastos) {
    chartGastos.data.labels = labels;
    chartGastos.data.datasets[0].data = data;
    chartGastos.update();
    return;
  }

  chartGastos = new Chart(document.getElementById("chartGastos"), {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map((l) => colores[l] || "#cccccc"),
        borderWidth: 0,
      }],
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
    (a, b) => new Date(a.fecha) - new Date(b.fecha)
  );

  const labels = [];
  const data = [];
  let acumulado = 0;

  for (let i = 0; i < ordenados.length; i++) {
    const m = ordenados[i];
    acumulado += m.tipo === "ingreso" ? m.monto : -m.monto;
    labels.push(m.fecha);
    data.push(acumulado);
  }

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
      datasets: [{
        label: "Balance (€)",
        data,
        borderColor: "#667eea",
        backgroundColor: "rgba(102, 126, 234, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: "#667eea",
      }],
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