// ============================================================
// Shared utilities for FinanceApp frontend
// ============================================================

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Show a toast notification.
 */
export function showToast(mensaje, tipo = "success") {
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

/**
 * Show a confirmation dialog. Returns a promise that resolves to boolean.
 */
export function showConfirm(mensaje) {
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

/**
 * Format a number as EUR currency (es-ES locale).
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
