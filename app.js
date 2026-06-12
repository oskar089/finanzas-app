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
        <button class="btn-eliminar" data-id="${movimiento.id}">Eliminar</button>
      </td>
    `;

    movimientosBody.appendChild(fila);
  }
}

function actualizarBalance() {
  const filtrados = getMovimientosFiltrados();
  let total = 0;

  for (let i = 0; i < filtrados.length; i++) {
    if (filtrados[i].tipo === "ingreso") {
      total += filtrados[i].monto;
    } else {
      total -= filtrados[i].monto;
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

  const nuevoMovimiento = {
    id: Date.now(),
    concepto,
    monto,
    tipo: tipoSelect.value,
    categoria: categoriaSelect.value,
    fecha,
  };

  movimientos.push(nuevoMovimiento);
  localStorage.setItem("movimientos", JSON.stringify(movimientos));
  form.reset();
  renderMovimientos();
  actualizarBalance();
});

movimientosBody.addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-eliminar")) {
    const id = Number(e.target.dataset.id);
    movimientos = movimientos.filter((m) => m.id !== id);
    localStorage.setItem("movimientos", JSON.stringify(movimientos));
    renderMovimientos();
    actualizarBalance();
  }
});

document.getElementById("filterTipo").addEventListener("change", (e) => {
  filterTipo = e.target.value;
  renderMovimientos();
  actualizarBalance();
});

document
  .getElementById("filterFechaDesde")
  .addEventListener("change", (e) => {
    filterFechaDesde = e.target.value;
    renderMovimientos();
    actualizarBalance();
  });

document
  .getElementById("filterFechaHasta")
  .addEventListener("change", (e) => {
    filterFechaHasta = e.target.value;
    renderMovimientos();
    actualizarBalance();
  });

document
  .getElementById("filterMontoMax")
  .addEventListener("input", (e) => {
    filterMontoMax = e.target.value;
    renderMovimientos();
    actualizarBalance();
  });

document
  .getElementById("filterCategoria")
  .addEventListener("change", (e) => {
    filterCategoria = e.target.value;
    renderMovimientos();
    actualizarBalance();
  });

document.querySelector("thead").addEventListener("click", (e) => {
  const th = e.target.closest("th");
  if (!th || !th.dataset.column) return;

  ordenarMovimientos(th.dataset.column);
  renderMovimientos();
  actualizarBalance();
});
