import { register, login, logout, isLoggedIn, getMe, loginWithGoogle, loginWithApple } from "./api.js";

// ============================================================
// DOM ELEMENTS
// ============================================================

const authScreen = document.getElementById("authScreen");
const mainApp = document.getElementById("mainApp");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authName = document.getElementById("authName");
const nameField = document.getElementById("nameField");
const authSubmitBtn = document.getElementById("authSubmitBtn");
const authError = document.getElementById("authError");
const authToggleLink = document.getElementById("authToggleLink");
const btnLogout = document.getElementById("btnLogout");
const btnGoogleLogin = document.getElementById("btnGoogleLogin");
const btnAppleLogin = document.getElementById("btnAppleLogin");
const userNameSpan = document.getElementById("userName");

let isLoginMode = true;

// ============================================================
// TOGGLE LOGIN/REGISTER
// ============================================================

authToggleLink.addEventListener("click", (e) => {
  e.preventDefault();
  isLoginMode = !isLoginMode;
  authError.textContent = "";
  updateAuthForm();
});

function updateAuthForm() {
  if (isLoginMode) {
    nameField.classList.add("d-none");
    authName.required = false;
    authSubmitBtn.textContent = "LOGIN";
    authToggleLink.textContent = "Create an account";
    document.getElementById("authTitle").textContent = "Iniciar Sesión";
  } else {
    nameField.classList.remove("d-none");
    authName.required = true;
    authSubmitBtn.textContent = "CREATE ACCOUNT";
    authToggleLink.textContent = "Login here";
    document.getElementById("authTitle").textContent = "Crear Cuenta";
  }
}

// ============================================================
// FORM SUBMIT
// ============================================================

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";

  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    authError.textContent = "Please fill in all fields.";
    return;
  }

  if (password.length < 6) {
    authError.textContent = "Password must be at least 6 characters.";
    return;
  }

  try {
    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = "LOADING...";

    if (isLoginMode) {
      await login(email, password);
    } else {
      const name = authName.value.trim();
      if (!name) {
        authError.textContent = "Please enter your name.";
        return;
      }
      await register(name, email, password);
    }

    showMainApp();
  } catch (err) {
    authError.textContent = err.message || "Authentication error.";
  } finally {
    authSubmitBtn.disabled = false;
    updateAuthForm();
  }
});

// ============================================================
// SOCIAL OAUTH BUTTONS — show only if backend has OAuth configured
// ============================================================

const socialAuthSection = document.getElementById("socialAuthSection");

async function detectOAuthProviders() {
  try {
    const res = await fetch("/api/auth/google", {
      method: "HEAD",
      redirect: "manual",
    });
    // 302/303 = OAuth redirect started → configured. 501 = not configured.
    if (res.status !== 501) {
      socialAuthSection.classList.remove("d-none");
      btnGoogleLogin.addEventListener("click", () => loginWithGoogle());
      btnAppleLogin.addEventListener("click", () => loginWithApple());
    }
  } catch {
    // Server unreachable — keep hidden
  }
}

detectOAuthProviders();

// ============================================================
// LOGOUT
// ============================================================

btnLogout.addEventListener("click", () => {
  logout();
});

// ============================================================
// SHOW APP OR AUTH
// ============================================================

async function showMainApp() {
  authScreen.classList.add("d-none");
  mainApp.classList.remove("d-none");

  try {
    const data = await getMe();
    userNameSpan.textContent = data.user?.name || data.user?.email || "Usuario";
  } catch {
    userNameSpan.textContent = "Usuario";
  }

  // Dispatch event so app.js can load data
  window.dispatchEvent(new CustomEvent("auth:ready"));
}

async function checkAuth() {
  if (isLoggedIn()) {
    try {
      await getMe();
      showMainApp();
    } catch {
      // Token invalid or expired
      logout();
    }
  } else {
    authScreen.classList.remove("d-none");
    mainApp.classList.add("d-none");
  }
}

// ============================================================
// INIT
// ============================================================

updateAuthForm();
checkAuth();
