import {
  getFamilyGroups,
  createFamilyGroup,
  inviteFamilyMember,
  removeFamilyMember,
  updateFamilyMemberRole,
  deleteFamilyGroup,
} from "./api.js";

// ============================================================
// DOM ELEMENTS
// ============================================================

const familyGroupForm = document.getElementById("familyGroupForm");
const familyGroupName = document.getElementById("familyGroupName");
const familyGroupsContainer = document.getElementById("familyGroupsContainer");

// ============================================================
// UTILITY FUNCTIONS (matching app.js pattern)
// ============================================================

function escapeHTML(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
// STATE
// ============================================================

let groups = [];

// ============================================================
// LOAD GROUPS
// ============================================================

async function loadGroups() {
  try {
    familyGroupsContainer.innerHTML =
      '<p class="text-muted mb-0">Cargando grupos familiares...</p>';

    const data = await getFamilyGroups();
    groups = data.families || [];

    renderGroups();
  } catch (err) {
    console.error("Error loading family groups:", err);
    showToast("Error al cargar grupos familiares", "danger");
    familyGroupsContainer.innerHTML =
      '<p class="text-muted mb-0">Error al cargar grupos familiares.</p>';
  }
}

// ============================================================
// RENDER
// ============================================================

function renderGroups() {
  if (groups.length === 0) {
    familyGroupsContainer.innerHTML =
      '<p class="text-muted mb-0">No formás parte de ningún grupo familiar. Creá uno arriba.</p>';
    return;
  }

  familyGroupsContainer.innerHTML = groups
    .map((g) => renderGroupCard(g))
    .join("");
}

function renderGroupCard(g) {
  const isAdmin = g.role === "ADMIN";

  return `
    <div class="card mb-3" data-family-id="${escapeHTML(g.id)}">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span>${escapeHTML(g.name)}</span>
        <div>
          <span class="badge ${isAdmin ? "bg-primary" : "bg-secondary"} me-2">${escapeHTML(g.role)}</span>
          ${isAdmin
            ? `<button class="btn btn-outline-danger btn-sm btn-delete-family-group" data-id="${escapeHTML(g.id)}">Eliminar grupo</button>`
            : ""}
        </div>
      </div>
      <div class="card-body">
        ${isAdmin
          ? `
          <!-- Invite Form -->
          <form class="invite-form row g-3 mb-3" data-family-id="${escapeHTML(g.id)}">
            <div class="col-md-4">
              <label class="form-label">Email del usuario</label>
              <input type="email" class="form-control form-control-sm invite-email" placeholder="email@ejemplo.com" required />
            </div>
            <div class="col-md-3">
              <label class="form-label">Rol</label>
              <select class="form-select form-select-sm invite-role">
                <option value="MEMBER">Miembro</option>
                <option value="VIEWER">Espectador</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <div class="col-md-2 d-flex align-items-end">
              <button type="submit" class="btn btn-primary btn-sm w-100">Invitar</button>
            </div>
          </form>`
          : ""}
        <!-- Members Table -->
        <table class="table table-sm mb-0">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              ${isAdmin ? "<th>Acciones</th>" : ""}
            </tr>
          </thead>
          <tbody>
            ${g.members.map((m) => renderMemberRow(g, m, isAdmin)).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderMemberRow(g, m, isAdmin) {
  return `
    <tr>
      <td>${escapeHTML(m.user?.name || "—")}</td>
      <td>${escapeHTML(m.user?.email || "—")}</td>
      <td>
        ${isAdmin
          ? `<select class="form-select form-select-sm role-select" data-family-id="${escapeHTML(g.id)}" data-member-id="${escapeHTML(m.user?.id || m.userId)}">
               <option value="ADMIN" ${m.role === "ADMIN" ? "selected" : ""}>Admin</option>
               <option value="MEMBER" ${m.role === "MEMBER" ? "selected" : ""}>Miembro</option>
               <option value="VIEWER" ${m.role === "VIEWER" ? "selected" : ""}>Espectador</option>
             </select>`
          : escapeHTML(m.role)}
      </td>
      ${isAdmin
        ? `<td>
            ${m.userId !== g.adminId
              ? `<button class="btn-eliminar btn-remove-member" data-family-id="${escapeHTML(g.id)}" data-member-id="${escapeHTML(m.user?.id || m.userId)}">Quitar</button>`
              : '<span class="text-muted small">Admin del grupo</span>'
            }
          </td>`
        : ""}
    </tr>
  `;
}

// ============================================================
// CREATE GROUP
// ============================================================

familyGroupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = familyGroupName.value.trim();
  if (!name) {
    showToast("El nombre del grupo es obligatorio.", "warning");
    return;
  }

  try {
    await createFamilyGroup(name);
    familyGroupName.value = "";
    showToast("Grupo familiar creado ✓", "success");
    await loadGroups();
  } catch (err) {
    showToast(err.message || "Error al crear el grupo", "danger");
  }
});

// ============================================================
// INVITE MEMBER (event delegation)
// ============================================================

familyGroupsContainer.addEventListener("submit", async (e) => {
  const form = e.target.closest(".invite-form");
  if (!form) return;
  e.preventDefault();

  const familyId = form.dataset.familyId;
  const email = form.querySelector(".invite-email").value.trim();
  const role = form.querySelector(".invite-role").value;

  if (!email) {
    showToast("El email es obligatorio.", "warning");
    return;
  }

  try {
    await inviteFamilyMember(familyId, email, role);
    form.querySelector(".invite-email").value = "";
    showToast("Miembro invitado ✓", "success");
    await loadGroups();
  } catch (err) {
    showToast(err.message || "Error al invitar miembro", "danger");
  }
});

// ============================================================
// ROLE CHANGE (event delegation)
// ============================================================

familyGroupsContainer.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("role-select")) return;

  const familyId = e.target.dataset.familyId;
  const memberId = e.target.dataset.memberId;
  const role = e.target.value;

  try {
    await updateFamilyMemberRole(familyId, memberId, role);
    showToast("Rol actualizado ✓", "success");
    // Reload to get fresh data
    await loadGroups();
  } catch (err) {
    showToast(err.message || "Error al actualizar el rol", "danger");
    // Reload to reset the select to the previous value
    await loadGroups();
  }
});

// ============================================================
// REMOVE MEMBER & DELETE GROUP (event delegation)
// ============================================================

familyGroupsContainer.addEventListener("click", async (e) => {
  if (e.target.classList.contains("btn-remove-member")) {
    const familyId = e.target.dataset.familyId;
    const memberId = e.target.dataset.memberId;

    const confirmado = await showConfirm(
      "¿Quitar este miembro del grupo?",
    );
    if (!confirmado) return;

    try {
      await removeFamilyMember(familyId, memberId);
      showToast("Miembro quitado.", "success");
      await loadGroups();
    } catch (err) {
      showToast(err.message || "Error al quitar el miembro", "danger");
    }
  }

  if (e.target.classList.contains("btn-delete-family-group")) {
    const id = e.target.dataset.id;
    const group = groups.find((g) => g.id === id);
    if (!group) return;

    const confirmado = await showConfirm(
      `¿Eliminar el grupo "${group.name}"? Esta acción no se puede deshacer.`,
    );
    if (!confirmado) return;

    try {
      await deleteFamilyGroup(id);
      showToast("Grupo eliminado.", "success");
      await loadGroups();
    } catch (err) {
      showToast(err.message || "Error al eliminar el grupo", "danger");
    }
  }
});

// ============================================================
// EXPORTS
// ============================================================

export { loadGroups };
