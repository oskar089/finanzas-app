// FinanceApp API Client
// Usamos ruta relativa para evitar problemas de CORS entre puertos.
// El backend sirve en /api y el frontend (Vite dev server o build) se comunica
// mediante proxy o mismo origen.
const API_BASE = "/api";

// ============================================================
// AUTH HELPERS
// ============================================================

function getToken() {
  return localStorage.getItem("token");
}

function setToken(token) {
  localStorage.setItem("token", token);
}

function clearToken() {
  localStorage.removeItem("token");
}

function isLoggedIn() {
  return !!getToken();
}

// ============================================================
// FETCH WRAPPER
// ============================================================

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || data.error || "API Error");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ============================================================
// AUTH API
// ============================================================

async function register(name, email, password) {
  const data = await apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  setToken(data.token);
  return data;
}

async function login(email, password) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data;
}

async function getMe() {
  return apiFetch("/auth/me");
}

async function updateProfile(updates) {
  return apiFetch("/auth/profile", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

function logout() {
  clearToken();
  window.location.reload();
}

// ============================================================
// ACCOUNTS API
// ============================================================

async function getAccounts() {
  return apiFetch("/accounts");
}

async function getAccount(id) {
  return apiFetch(`/accounts/${id}`);
}

async function createAccount(data) {
  return apiFetch("/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateAccount(id, data) {
  return apiFetch(`/accounts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteAccount(id) {
  return apiFetch(`/accounts/${id}`, {
    method: "DELETE",
  });
}

// ============================================================
// TRANSACTIONS API
// ============================================================

async function getTransactions(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.append("page", params.page);
  if (params.limit) query.append("limit", params.limit);
  if (params.type) query.append("type", params.type);
  if (params.category) query.append("category", params.category);
  if (params.accountId) query.append("accountId", params.accountId);
  if (params.startDate) query.append("startDate", params.startDate);
  if (params.endDate) query.append("endDate", params.endDate);
  if (params.minAmount) query.append("minAmount", params.minAmount);
  if (params.maxAmount) query.append("maxAmount", params.maxAmount);
  if (params.concept) query.append("concept", params.concept);
  if (params.sortBy) query.append("sortBy", params.sortBy);
  if (params.sortOrder) query.append("sortOrder", params.sortOrder);

  const qs = query.toString();
  return apiFetch(`/transactions${qs ? "?" + qs : ""}`);
}

async function getTransaction(id) {
  return apiFetch(`/transactions/${id}`);
}

async function createTransaction(data) {
  return apiFetch("/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateTransaction(id, data) {
  return apiFetch(`/transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteTransaction(id) {
  return apiFetch(`/transactions/${id}`, {
    method: "DELETE",
  });
}

async function bulkCreateTransactions(transactions) {
  return apiFetch("/transactions/bulk", {
    method: "POST",
    body: JSON.stringify({ transactions }),
  });
}

// ============================================================
// BUDGETS API
// ============================================================

async function getBudgets(params = {}) {
  const query = new URLSearchParams();
  if (params.month) query.append("month", params.month);
  if (params.year) query.append("year", params.year);

  const qs = query.toString();
  return apiFetch(`/budgets${qs ? "?" + qs : ""}`);
}

async function getBudgetSummary(params = {}) {
  const query = new URLSearchParams();
  if (params.month) query.append("month", params.month);
  if (params.year) query.append("year", params.year);

  const qs = query.toString();
  return apiFetch(`/budgets/summary${qs ? "?" + qs : ""}`);
}

async function createBudget(data) {
  return apiFetch("/budgets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function updateBudget(id, data) {
  return apiFetch(`/budgets/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

async function deleteBudget(id) {
  return apiFetch(`/budgets/${id}`, {
    method: "DELETE",
  });
}

async function copyBudgets(fromMonth, fromYear, toMonth, toYear) {
  return apiFetch("/budgets/copy", {
    method: "POST",
    body: JSON.stringify({ fromMonth, fromYear, toMonth, toYear }),
  });
}

// ============================================================
// DASHBOARD API
// ============================================================

async function getDashboard() {
  return apiFetch("/dashboard");
}

async function getDashboardMonthly(params = {}) {
  const query = new URLSearchParams();
  if (params.month) query.append("month", params.month);
  if (params.year) query.append("year", params.year);

  const qs = query.toString();
  return apiFetch(`/dashboard/monthly${qs ? "?" + qs : ""}`);
}

// ============================================================
// FAMILY API
// ============================================================

async function getFamilyGroups() {
  return apiFetch("/family");
}

async function createFamilyGroup(name) {
  return apiFetch("/family", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

async function inviteFamilyMember(familyId, email, role) {
  return apiFetch(`/family/${familyId}/invite`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });
}

async function removeFamilyMember(familyId, memberId) {
  return apiFetch(`/family/${familyId}/members/${memberId}`, {
    method: "DELETE",
  });
}

async function updateFamilyMemberRole(familyId, memberId, role) {
  return apiFetch(`/family/${familyId}/members/${memberId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

async function deleteFamilyGroup(familyId) {
  return apiFetch(`/family/${familyId}`, {
    method: "DELETE",
  });
}

// ============================================================
// EXPORTS
// ============================================================

export {
  // Auth
  register,
  login,
  getMe,
  updateProfile,
  logout,
  isLoggedIn,
  getToken,
  // Accounts
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  // Transactions
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkCreateTransactions,
  // Budgets
  getBudgets,
  getBudgetSummary,
  createBudget,
  updateBudget,
  deleteBudget,
  copyBudgets,
  // Dashboard
  getDashboard,
  getDashboardMonthly,
  // Family
  getFamilyGroups,
  createFamilyGroup,
  inviteFamilyMember,
  removeFamilyMember,
  updateFamilyMemberRole,
  deleteFamilyGroup,
};
