"use strict";

/* =========================================================
   ÁGORA INNOVATION HUB
   Conexión con Apps Script + filtros + modal + apoyos
   ========================================================= */

const API_URL =
  "https://script.google.com/macros/s/AKfycbxPdMLeAlchVVZltW1knBOeNvQqgmL-qfaaGfDUZoIBqLd-DKVPK3uDy7qFmou91DvqzQ/exec";

/*
  Estos logotipos se cargan desde la carpeta assets de GitHub.
  Verifica que los nombres sean exactamente iguales.
*/
const LOCAL_LOGOS = {
  "PROY-0001": "./assets/logo-taxichurro.png",
  "PROY-0002": "./assets/logo-compraya.png",
  "PROY-0003": "./assets/logo-huellitas.png",
  "PROY-0004": "./assets/logo-selvaviva.png"
};

const state = {
  projects: [],
  members: [],
  supports: {},
  filteredProjects: []
};

const elements = {
  grid: document.querySelector("#projects-grid"),
  status: document.querySelector("#status-message"),
  empty: document.querySelector("#empty-state"),

  search: document.querySelector("#search-input"),
  campus: document.querySelector("#campus-filter"),
  level: document.querySelector("#level-filter"),
  grade: document.querySelector("#grade-filter"),
  category: document.querySelector("#category-filter"),
  clear: document.querySelector("#clear-filters"),

  projectsCount: document.querySelector("#projects-count"),
  campusesCount: document.querySelector("#campuses-count"),
  categoriesCount: document.querySelector("#categories-count"),
  studentsCount: document.querySelector("#students-count"),

  modal: document.querySelector("#project-modal"),
  modalBody: document.querySelector("#modal-body"),
  toast: document.querySelector("#toast")
};

document.addEventListener("DOMContentLoaded", initializeApp);

/* =========================================================
   INICIO
   ========================================================= */

async function initializeApp() {
  validateRequiredElements();
  bindEvents();
  await loadData();
}

function validateRequiredElements() {
  const required = [
    "grid",
    "status",
    "empty",
    "search",
    "campus",
    "level",
    "grade",
    "category",
    "clear",
    "projectsCount",
    "campusesCount",
    "categoriesCount",
    "studentsCount",
    "modal",
    "modalBody"
  ];

  const missing = required.filter(name => !elements[name]);

  if (missing.length) {
    console.error(
      "Faltan elementos requeridos en index.html:",
      missing.join(", ")
    );
  }
}

function bindEvents() {
  elements.search?.addEventListener("input", applyFilters);
  elements.campus?.addEventListener("change", applyFilters);
  elements.level?.addEventListener("change", applyFilters);
  elements.grade?.addEventListener("change", applyFilters);
  elements.category?.addEventListener("change", applyFilters);

  elements.clear?.addEventListener("click", clearFilters);

  document.addEventListener("click", event => {
    const detailsButton = event.target.closest("[data-project-id]");

    if (detailsButton) {
      openProjectModal(detailsButton.dataset.projectId);
      return;
    }

    const supportButton = event.target.closest("[data-support-id]");

    if (supportButton) {
      supportProject(
        supportButton.dataset.supportId,
        supportButton
      );
      return;
    }

    if (event.target.closest("[data-close-modal]")) {
      closeModal();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeModal();
    }
  });
}

/* =========================================================
   CARGA DE DATOS
   ========================================================= */

async function loadData() {
  showLoading();

  try {
    const response = await fetch(
      `${API_URL}?action=all&_=${Date.now()}`,
      {
        method: "GET",
        redirect: "follow",
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        `La API respondió con el código ${response.status}.`
      );
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.error ||
          "La API no pudo devolver la información."
      );
    }

    const data = result.data || {};

    state.projects = Array.isArray(data.proyectos)
      ? data.proyectos
      : [];

    state.members = Array.isArray(data.integrantes)
      ? data.integrantes
      : [];

    state.supports =
      data.apoyos &&
      typeof data.apoyos === "object"
        ? data.apoyos
        : {};

    state.filteredProjects = [...state.projects];

    populateFilters();
    updateStatistics();
    renderProjects(state.filteredProjects);
    hideLoading();
  } catch (error) {
    console.error("Error al cargar la API:", error);

    showError(
      "No se pudieron cargar los proyectos. " +
        "Verifica la implementación de Apps Script y vuelve a intentarlo."
    );
  }
}

/* =========================================================
   FILTROS
   ========================================================= */

function populateFilters() {
  fillSelect(
    elements.campus,
    uniqueValues(state.projects, "sede"),
    "Todas"
  );

  fillSelect(
    elements.level,
    uniqueValues(state.projects, "nivel"),
    "Todos"
  );

  fillSelect(
    elements.grade,
    uniqueValues(state.projects, "grado"),
    "Todos"
  );

  fillSelect(
    elements.category,
    uniqueValues(state.projects, "categoria"),
    "Todas"
  );
}

function uniqueValues(items, field) {
  return [
    ...new Set(
      items
        .map(item =>
          String(item[field] || "").trim()
        )
        .filter(Boolean)
    )
  ].sort((a, b) =>
    a.localeCompare(b, "es", {
      numeric: true,
      sensitivity: "base"
    })
  );
}

function fillSelect(select, values, defaultLabel) {
  if (!select) {
    return;
  }

  select.innerHTML = "";

  const initialOption = document.createElement("option");
  initialOption.value = "";
  initialOption.textContent = defaultLabel;
  select.appendChild(initialOption);

  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function applyFilters() {
  const query = normalizeText(
    elements.search?.value || ""
  );

  const campus =
    elements.campus?.value || "";

  const level =
    elements.level?.value || "";

  const grade =
    elements.grade?.value || "";

  const category =
    elements.category?.value || "";

  state.filteredProjects = state.projects.filter(project => {
    const searchableContent = normalizeText(
      [
        project.proyecto,
        project.descripcion_corta,
        project.categoria,
        project.sede,
        project.nivel,
        project.grado
      ].join(" ")
    );

    const matchesQuery =
      !query ||
      searchableContent.includes(query);

    const matchesCampus =
      !campus ||
      project.sede === campus;

    const matchesLevel =
      !level ||
      project.nivel === level;

    const matchesGrade =
      !grade ||
      project.grado === grade;

    const matchesCategory =
      !category ||
      project.categoria === category;

    return (
      matchesQuery &&
      matchesCampus &&
      matchesLevel &&
      matchesGrade &&
      matchesCategory
    );
  });

  renderProjects(state.filteredProjects);
}

function clearFilters() {
  if (elements.search) {
    elements.search.value = "";
  }

  if (elements.campus) {
    elements.campus.value = "";
  }

  if (elements.level) {
    elements.level.value = "";
  }

  if (elements.grade) {
    elements.grade.value = "";
  }

  if (elements.category) {
    elements.category.value = "";
  }

  state.filteredProjects = [...state.projects];

  renderProjects(state.filteredProjects);
}

/* =========================================================
   ESTADÍSTICAS
   ========================================================= */

function updateStatistics() {
  if (elements.projectsCount) {
    elements.projectsCount.textContent =
      state.projects.length;
  }

  if (elements.campusesCount) {
    elements.campusesCount.textContent =
      uniqueValues(state.projects, "sede").length;
  }

  if (elements.categoriesCount) {
    elements.categoriesCount.textContent =
      uniqueValues(state.projects, "categoria").length;
  }

  if (elements.studentsCount) {
    elements.studentsCount.textContent =
      state.members.length;
  }
}

/* =========================================================
   TARJETAS
   ========================================================= */

function renderProjects(projects) {
  if (!elements.grid) {
    return;
  }

  elements.grid.innerHTML = "";

  if (!projects.length) {
    elements.empty?.classList.remove("hidden");
    return;
  }

  elements.empty?.classList.add("hidden");

  projects.forEach(project => {
    elements.grid.appendChild(
      createProjectCard(project)
    );
  });
}

function createProjectCard(project) {
  const article = document.createElement("article");
  article.className = "project-card";

  const imageUrl =
    LOCAL_LOGOS[project.id] ||
    getCleanUrl(
      project.logo ||
      project.imagen
    );

  const prototypeUrl =
    getCleanUrl(project.prototipo);

  const documentUrl =
    getCleanUrl(project.documento);

  const supportCount =
    Number(
      state.supports[project.id] || 0
    );

  const supported =
    localStorage.getItem(
      `agora-supported-${project.id}`
    ) === "1";

  article.innerHTML = `
    <div class="project-image-wrap">
      <span class="project-badge">
        ${escapeHtml(
          project.estado ||
          "Proyecto"
        )}
      </span>

      ${
        imageUrl
          ? `
            <img
              class="project-image"
              src="${escapeAttribute(imageUrl)}"
              alt="Logo de ${escapeAttribute(
                project.proyecto ||
                "proyecto"
              )}"
              loading="lazy"
              onerror="
                this.style.display='none';
                this.nextElementSibling.style.display='block';
              "
            >

            <div
              class="project-placeholder"
              style="display:none"
            >
              💡
            </div>
          `
          : `
            <div class="project-placeholder">
              💡
            </div>
          `
      }
    </div>

    <div class="project-content">
      <div class="project-meta">
        <span>
          🏫 ${escapeHtml(
            project.sede ||
            "Ágora"
          )}
        </span>

        <span>
          🎓 ${escapeHtml(
            project.grado ||
            project.nivel ||
            ""
          )}
        </span>

        <span>
          💡 ${escapeHtml(
            project.categoria ||
            "Innovación"
          )}
        </span>
      </div>

      <h3>
        ${escapeHtml(
          project.proyecto ||
          "Proyecto Ágora"
        )}
      </h3>

      <p class="project-description">
        ${escapeHtml(
          project.descripcion_corta ||
          "Proyecto desarrollado por estudiantes de Ágora."
        )}
      </p>

      <div class="project-actions">
        <button
          class="btn btn-outline"
          type="button"
          data-project-id="${escapeAttribute(
            project.id || ""
          )}"
        >
          Conocer proyecto
        </button>

        ${
          prototypeUrl
            ? `
              <a
                class="btn btn-primary"
                href="${escapeAttribute(prototypeUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Probar prototipo
              </a>
            `
            : ""
        }

        ${
          documentUrl
            ? `
              <a
                class="btn btn-orange"
                href="${escapeAttribute(documentUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver documento
              </a>
            `
            : ""
        }
      </div>

      <div class="support-row">
        <button
          class="support-btn ${
            supported
              ? "supported"
              : ""
          }"
          type="button"
          data-support-id="${escapeAttribute(
            project.id || ""
          )}"
        >
          ${
            supported
              ? "❤️ Proyecto apoyado"
              : "🤍 Apoyar proyecto"
          }
        </button>

        <span class="support-count">
          ${supportCount}
          ${
            supportCount === 1
              ? " apoyo"
              : " apoyos"
          }
        </span>
      </div>
    </div>
  `;

  return article;
}

/* =========================================================
   APOYOS / CORAZONES
   ========================================================= */

async function supportProject(
  projectId,
  button
) {
  if (!projectId) {
    return;
  }

  const storageKey =
    `agora-supported-${projectId}`;

  if (
    localStorage.getItem(storageKey) === "1"
  ) {
    showToast(
      "Ya apoyaste este proyecto desde este navegador."
    );
    return;
  }

  const originalText =
    button?.textContent || "";

  try {
    if (button) {
      button.disabled = true;
      button.textContent =
        "Registrando apoyo...";
    }

    const formData =
      new URLSearchParams();

    formData.append(
      "action",
      "support"
    );

    formData.append(
      "projectId",
      projectId
    );

    const response = await fetch(
      API_URL,
      {
        method: "POST",
        body: formData,
        redirect: "follow"
      }
    );

    if (!response.ok) {
      throw new Error(
        `Error HTTP ${response.status}`
      );
    }

    const result =
      await response.json();

    if (!result.success) {
      throw new Error(
        result.error ||
        "No se pudo registrar el apoyo."
      );
    }

    localStorage.setItem(
      storageKey,
      "1"
    );

    state.supports[projectId] =
      Number(result.count || 0);

    renderProjects(
      state.filteredProjects
    );

    showToast(
      "¡Gracias por apoyar el talento Ágora! ❤️"
    );
  } catch (error) {
    console.error(
      "Error al registrar apoyo:",
      error
    );

    showToast(
      "No se pudo registrar el apoyo. Revisa Apps Script e intenta nuevamente."
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        originalText;
    }
  }
}

/* =========================================================
   MODAL
   ========================================================= */

function openProjectModal(projectId) {
  const project =
    state.projects.find(
      item =>
        String(item.id) ===
        String(projectId)
    );

  if (!project) {
    return;
  }

  const members =
    state.members
      .filter(
        member =>
          String(
            member.id_proyecto
          ) === String(projectId)
      )
      .sort(
        (a, b) =>
          Number(a.orden || 999) -
          Number(b.orden || 999)
      );

  const imageUrl =
    LOCAL_LOGOS[project.id] ||
    getCleanUrl(
      project.logo ||
      project.imagen
    );

  const prototypeUrl =
    getCleanUrl(
      project.prototipo
    );

  const documentUrl =
    getCleanUrl(
      project.documento
    );

  const supportCount =
    Number(
      state.supports[project.id] || 0
    );

  const supported =
    localStorage.getItem(
      `agora-supported-${project.id}`
    ) === "1";

  elements.modalBody.innerHTML = `
    ${
      imageUrl
        ? `
          <img
            class="modal-image"
            src="${escapeAttribute(imageUrl)}"
            alt="${escapeAttribute(
              project.proyecto || ""
            )}"
          >
        `
        : ""
    }

    <div class="modal-info">
      <div class="project-meta">
        <span>
          🏫 ${escapeHtml(
            project.sede || ""
          )}
        </span>

        <span>
          🎓 ${escapeHtml(
            project.grado ||
            project.nivel ||
            ""
          )}
        </span>

        <span>
          💡 ${escapeHtml(
            project.categoria || ""
          )}
        </span>
      </div>

      <h2 id="modal-project-title">
        ${escapeHtml(
          project.proyecto ||
          "Proyecto Ágora"
        )}
      </h2>

      <p>
        ${escapeHtml(
          project.descripcion_corta ||
          "Proyecto desarrollado por estudiantes de Ágora."
        )}
      </p>

      ${
        members.length
          ? `
            <section class="modal-members">
              <h3>
                Integrantes del equipo
              </h3>

              <ul>
                ${members
                  .map(
                    member => `
                      <li>
                        <strong>
                          ${escapeHtml(
                            member.nombre_completo ||
                            ""
                          )}
                        </strong>

                        ${
                          member.rol
                            ? `
                              — ${escapeHtml(
                                member.rol
                              )}
                            `
                            : ""
                        }
                      </li>
                    `
                  )
                  .join("")}
              </ul>
            </section>
          `
          : `
            <section class="modal-members">
              <h3>
                Integrantes del equipo
              </h3>

              <p>
                La información de los integrantes todavía no está completa en Google Sheets.
              </p>
            </section>
          `
      }

      <div
        class="project-actions"
        style="margin-top:24px"
      >
        ${
          prototypeUrl
            ? `
              <a
                class="btn btn-primary"
                href="${escapeAttribute(
                  prototypeUrl
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Probar prototipo
              </a>
            `
            : ""
        }

        ${
          documentUrl
            ? `
              <a
                class="btn btn-orange"
                href="${escapeAttribute(
                  documentUrl
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver proyecto completo
              </a>
            `
            : ""
        }
      </div>

      <div class="support-row">
        <button
          class="support-btn ${
            supported
              ? "supported"
              : ""
          }"
          type="button"
          data-support-id="${escapeAttribute(
            project.id || ""
          )}"
        >
          ${
            supported
              ? "❤️ Proyecto apoyado"
              : "🤍 Apoyar proyecto"
          }
        </button>

        <span class="support-count">
          ${supportCount}
          ${
            supportCount === 1
              ? " apoyo"
              : " apoyos"
          }
        </span>
      </div>
    </div>
  `;

  elements.modal.classList.remove(
    "hidden"
  );

  document.body.classList.add(
    "modal-open"
  );
}

function closeModal() {
  elements.modal?.classList.add(
    "hidden"
  );

  document.body.classList.remove(
    "modal-open"
  );
}

/* =========================================================
   MENSAJES
   ========================================================= */

function showLoading() {
  elements.status?.classList.remove(
    "hidden"
  );

  elements.grid?.classList.add(
    "hidden"
  );

  elements.empty?.classList.add(
    "hidden"
  );
}

function hideLoading() {
  elements.status?.classList.add(
    "hidden"
  );

  elements.grid?.classList.remove(
    "hidden"
  );
}

function showError(message) {
  if (!elements.status) {
    return;
  }

  elements.status.classList.remove(
    "hidden"
  );

  elements.status.innerHTML = `
    <div style="font-size:2.5rem">
      ⚠️
    </div>

    <h3 style="color:#283315">
      No pudimos cargar la información
    </h3>

    <p>
      ${escapeHtml(message)}
    </p>
  `;
}

function showToast(message) {
  if (!elements.toast) {
    alert(message);
    return;
  }

  elements.toast.textContent =
    message;

  elements.toast.classList.remove(
    "hidden"
  );

  window.setTimeout(() => {
    elements.toast.classList.add(
      "hidden"
    );
  }, 3500);
}

/* =========================================================
   UTILIDADES
   ========================================================= */

function getCleanUrl(value) {
  const text =
    String(value || "").trim();

  if (!text) {
    return "";
  }

  const match =
    text.match(
      /https?:\/\/[^\s()]+/i
    );

  return match
    ? match[0]
    : "";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
