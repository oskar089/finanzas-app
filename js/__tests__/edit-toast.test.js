import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Regression: movement form toast must say "actualizado" on edits
// ============================================================
// cancelarEdicion() resets editandoId before the success toast
// evaluates it, so edits used to always toast "Movimiento agregado".

// Shape must survive the update path (data/datasets/options.scales mutation
// performed by actualizarChartGastos/actualizarChartMensual on re-render)
globalThis.Chart = class {
  constructor() {
    this.data = { labels: [], datasets: [{}, {}] };
    this.options = { scales: { x: { grid: {} }, y: { grid: {} } }, plugins: {} };
  }
  update() {}
};

vi.mock("../api.js", () => ({
  register: vi.fn(),
  login: vi.fn(),
  getMe: vi.fn(),
  updateProfile: vi.fn(),
  logout: vi.fn(),
  loginWithGoogle: vi.fn(),
  loginWithApple: vi.fn(),
  isLoggedIn: vi.fn(() => false),
  getToken: vi.fn(() => null),
  clearToken: vi.fn(),
  getAccounts: vi.fn(),
  getAccount: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  deleteAccount: vi.fn(),
  getTransactions: vi.fn(),
  getTransaction: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  bulkCreateTransactions: vi.fn(),
  getBudgets: vi.fn(async () => ({ budgets: [] })),
  getBudgetSummary: vi.fn(async () => ({})),
  createBudget: vi.fn(),
  updateBudget: vi.fn(),
  deleteBudget: vi.fn(),
  copyBudgets: vi.fn(),
  getDashboard: vi.fn(async () => ({})),
  getDashboardMonthly: vi.fn(async () => ({ monthlyData: [] })),
  getCategories: vi.fn(async () => ({
    categories: [{ id: "cat-1", name: "Comida", type: "EXPENSE" }],
  })),
  getCategory: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getFamilyGroups: vi.fn(async () => ({ families: [] })),
  createFamilyGroup: vi.fn(),
  inviteFamilyMember: vi.fn(),
  removeFamilyMember: vi.fn(),
  updateFamilyMemberRole: vi.fn(),
  deleteFamilyGroup: vi.fn(),
}));

import {
  getAccounts,
  getTransactions,
  createTransaction,
  updateTransaction,
} from "../api.js";

const ACCOUNTS = [
  { id: "acc-1", name: "Efectivo", type: "CASH", currency: "USD", balance: 100 },
];

const TRANSACTIONS = [
  {
    id: "tx-1",
    date: "2026-01-15T12:00:00.000Z",
    description: "Café",
    amount: 10,
    type: "EXPENSE",
    category: "Comida",
    accountId: "acc-1",
  },
];

function setupDom() {
  document.body.innerHTML = `
    <div id="toastContainer"></div>
    <div id="confirmOverlay" class="d-none">
      <p id="confirmMessage"></p>
      <button id="confirmAcceptBtn"></button>
      <button id="confirmCancelBtn"></button>
    </div>

    <table>
      <thead>
        <tr>
          <th data-column="fecha">Fecha</th>
          <th data-column="concepto">Concepto</th>
          <th data-column="tipo">Tipo</th>
          <th data-column="categoria">Categoria</th>
          <th data-column="monto">Monto ($)</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody id="movimientosTableBody"></tbody>
    </table>
    <span id="totalBalance"></span>
    <canvas id="chartGastos"></canvas>
    <canvas id="chartMensual"></canvas>

    <select id="accountSelect"></select>
    <button id="btnManageAccounts"></button>
    <div id="accountManagementRow" class="d-none">
      <form id="accountForm">
        <div id="accountFormTitle"></div>
        <input id="accountName" />
        <select id="accountType"><option value="CASH">Efectivo</option></select>
        <input id="accountCurrency" value="USD" />
        <input id="accountBalance" />
        <button type="submit" id="saveAccountBtn"></button>
        <button type="button" id="cancelAccountEditBtn"></button>
      </form>
    </div>
    <div id="accountListRow" class="d-none">
      <table><tbody id="accountsTableBody"></tbody></table>
    </div>

    <form id="addMovementForm">
      <div id="formTitle"></div>
      <input id="concepto" />
      <input id="monto" />
      <select id="tipo">
        <option value="gasto">Gasto</option>
        <option value="ingreso">Ingreso</option>
      </select>
      <input id="categoria" list="categoriaSuggestions" />
      <datalist id="categoriaSuggestions"></datalist>
      <input id="fecha" />
      <button type="submit" id="addMovimientoBtn"></button>
      <button type="button" id="btnCancelEdit"></button>
    </form>
    <button id="btnExportCSV"></button>
    <button id="btnImportCSV"></button>
    <input type="file" id="fileInput" />
    <button id="btnDarkMode"></button>

    <select id="filterTipo"><option value="todos">Todos</option></select>
    <select id="filterCategoria"><option value="todas">Todas</option></select>
    <input type="date" id="filterFechaDesde" />
    <input type="date" id="filterFechaHasta" />
    <input type="number" id="filterMontoMin" />
    <input type="number" id="filterMontoMax" />
    <input type="text" id="filterConcepto" />

    <div id="paginationControls" class="d-none">
      <nav>
        <ul>
          <li id="prevPageBtn"><button type="button"></button></li>
          <li><span id="pageIndicator"></span></li>
          <li id="nextPageBtn"><button type="button"></button></li>
        </ul>
      </nav>
    </div>

    <select id="budgetMonth"></select>
    <select id="budgetYear"></select>
    <select id="budgetCategory"></select>
    <form id="budgetForm">
      <div id="budgetFormTitle"></div>
      <input id="budgetAmount" />
      <button type="submit" id="saveBudgetBtn"></button>
      <button type="button" id="cancelBudgetEditBtn"></button>
    </form>
    <div id="budgetsContainer"></div>
    <button id="btnCopyBudgets"></button>

    <form id="familyGroupForm"><input id="familyGroupName" /></form>
    <div id="familyGroupsContainer"></div>
  `;
}

function lastToastText() {
  const container = document.getElementById("toastContainer");
  return container.lastElementChild?.textContent ?? "";
}

async function bootApp() {
  await import("../app.js");
  window.dispatchEvent(new Event("auth:ready"));
  await vi.waitFor(() => {
    expect(
      document.querySelectorAll("#movimientosTableBody tr").length,
    ).toBe(TRANSACTIONS.length);
  });
}

describe("movement form submit toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    Element.prototype.scrollIntoView = vi.fn();
    setupDom();

    getAccounts.mockResolvedValue({ accounts: ACCOUNTS });
    getTransactions.mockResolvedValue({
      transactions: TRANSACTIONS,
      pagination: { page: 1, totalPages: 1 },
    });
    createTransaction.mockResolvedValue({});
    updateTransaction.mockResolvedValue({});
  });

  it("shows 'Movimiento actualizado' after saving an edit", async () => {
    await bootApp();

    document.querySelector("#movimientosTableBody .btn-editar").click();
    expect(document.getElementById("formTitle").textContent).toBe(
      "Editar movimiento",
    );

    document
      .getElementById("addMovementForm")
      .dispatchEvent(new Event("submit", { cancelable: true }));

    await vi.waitFor(() => {
      expect(updateTransaction).toHaveBeenCalledTimes(1);
    });
    expect(updateTransaction).toHaveBeenCalledWith(
      "tx-1",
      expect.objectContaining({ description: "Café", amount: 10 }),
    );
    expect(createTransaction).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(lastToastText()).toBe("Movimiento actualizado ✓");
    });
  });

  it("shows 'Movimiento agregado' when creating a new movement", async () => {
    await bootApp();

    const concepto = document.getElementById("concepto");
    concepto.value = "Taxi";
    document.getElementById("monto").value = "25,5";
    document.getElementById("fecha").value = "2026-02-20";
    // tipo stays "gasto"; categoría "Comida" already exists

    document
      .getElementById("addMovementForm")
      .dispatchEvent(new Event("submit", { cancelable: true }));

    await vi.waitFor(() => {
      expect(createTransaction).toHaveBeenCalledTimes(1);
    });
    expect(updateTransaction).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(lastToastText()).toBe("Movimiento agregado ✓");
    });
  });
});
