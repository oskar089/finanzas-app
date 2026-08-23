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

// ============================================================
// Pure CSV / import-limit helpers
// ============================================================

/**
 * Escape one CSV field (RFC 4180 style): every field is wrapped in double
 * quotes and embedded double quotes are doubled. Quoting also neutralizes
 * the ';' separator and preserves newlines inside the value.
 */
export function csvEscapeField(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/**
 * Build one ';' separated CSV row with every field quoted.
 */
export function buildCsvRow(fields) {
  return fields.map(csvEscapeField).join(";");
}

/**
 * Parse a delimited text (RFC 4180 compliant) into an array of rows.
 * Handles:
 *   - Quoted fields (double quotes)
 *   - Doubled-quote unescaping ("" → ")
 *   - Delimiters and newlines inside quoted fields
 *   - CRLF and LF line endings
 *   - No trailing newline required
 * @param {string} text - The input text to parse
 * @param {string} delimiter - Field delimiter (default ';')
 * @returns {string[][]} Array of rows, each row is an array of fields
 */
export function parseDelimited(text, delimiter = ";") {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Doubled quote → literal quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        // Any character inside quotes (including delimiter, newline)
        currentField += char;
        i++;
        continue;
      }
    }

    // Not in quotes
    if (char === '"') {
      // Opening quote
      inQuotes = true;
      i++;
      continue;
    }

    if (char === delimiter) {
      // Field separator
      currentRow.push(currentField);
      currentField = "";
      i++;
      continue;
    }

    if (char === "\r" && nextChar === "\n") {
      // CRLF line ending
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      i += 2;
      continue;
    }

    if (char === "\n" || char === "\r") {
      // LF or standalone CR line ending
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      i++;
      continue;
    }

    // Regular character
    currentField += char;
    i++;
  }

  // Push the last field/row if there's content (handles no trailing newline)
  if (currentField !== "" || currentRow.length > 0 || text.endsWith(delimiter)) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Remove trailing empty row if input ended with newline (common case)
  if (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }

  return rows;
}

// Must mirror the server-side cap on POST /api/transactions/bulk
// (bulkCreateSchema z.array(...).max(1000) in api/src/routes/transactions.js).
export const BULK_IMPORT_MAX_ROWS = 1000;

/**
 * True when a parsed import row count exceeds the backend bulk cap.
 */
export function exceedsBulkLimit(rowCount) {
  return rowCount > BULK_IMPORT_MAX_ROWS;
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
 * Format a number as currency (es-ES locale) for a specific ISO 4217 code.
 */
export function formatCurrencyIn(amount, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Format a number as EUR currency (es-ES locale).
 */
export function formatCurrency(amount) {
  return formatCurrencyIn(amount);
}
