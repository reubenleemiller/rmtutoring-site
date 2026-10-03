(function () {
  const searchInput = document.getElementById("resource-search");
  const categoryFilter = document.getElementById("resource-category-filter");
  const typeFilter = document.getElementById("resource-type-filter");
  const breadcrumbs = document.getElementById("resource-breadcrumbs");
  const foldersGrid = document.getElementById("resource-folders");
  const folderEmpty = document.getElementById("resource-folder-empty");
  const filesGrid = document.getElementById("resource-grid");
  const resultsCount = document.getElementById("resource-results-count");
  const emptyState = document.getElementById("resource-empty-state");
  const loader = document.getElementById("resource-loading");
  const previewModal = document.getElementById("resource-preview-modal");
  const previewDialog = document.querySelector(".resource-preview-dialog");
  const previewTitle = document.getElementById("resource-preview-title");
  const previewBody = document.getElementById("resource-preview-body");
  const previewCloseBtn = document.getElementById("resource-preview-close-btn");
  const modalDownloadBtn = document.getElementById("resource-modal-download-btn");

  if (
    !searchInput ||
    !categoryFilter ||
    !typeFilter ||
    !breadcrumbs ||
    !foldersGrid ||
    !folderEmpty ||
    !filesGrid ||
    !resultsCount ||
    !emptyState ||
    !loader ||
    !previewModal ||
    !previewDialog ||
    !previewTitle ||
    !previewBody ||
    !previewCloseBtn ||
    !modalDownloadBtn
  ) {
    return;
  }

  const BROWSER_ENDPOINT = "/.netlify/functions/resource-browser";
  const FILE_ENDPOINT = "/.netlify/functions/resource-file";
  let state = {
    path: "",
    folders: [],
    files: [],
    breadcrumbs: [],
    filters: { categories: [], types: [] }
  };
  let activePreviewFile = null;
  let previewTrigger = null;
  let modalEventBindingsDone = false;

  const FILE_TYPE_ICONS = {
    pdf: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#D32F2F" d="M6 2h8l4 4v16H6z"/><path fill="#fff" d="M14 2v4h4"/><path fill="#fff" d="M8 14h2.3a1.7 1.7 0 0 0 0-3.4H8zm1.2-1h1a.5.5 0 1 1 0 1h-1zm3.1 1h2.4v-1h-1.2v-.6h1.2v-1h-2.4zm3.4 0H18a1.5 1.5 0 0 0 0-3h-2.3zm1.2-2h1a.5.5 0 0 1 0 1h-1z"/></svg>`,
    doc: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1565C0" d="M6 2h8l4 4v16H6z"/><path fill="#fff" d="M14 2v4h4"/><path fill="#fff" d="M8 11h8v1.5H8zm0 3h8v1.5H8zm0 3h5v1.5H8z"/></svg>`,
    docx: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1565C0" d="M6 2h8l4 4v16H6z"/><path fill="#fff" d="M14 2v4h4"/><path fill="#fff" d="M8 11h8v1.5H8zm0 3h8v1.5H8zm0 3h5v1.5H8z"/></svg>`,
    xls: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#2E7D32" d="M6 2h8l4 4v16H6z"/><path fill="#fff" d="M14 2v4h4"/><path fill="#fff" d="M9 11h2l1 1.7L13 11h2l-2 3 2 3h-2l-1-1.6L11 17H9l2-3z"/></svg>`,
    xlsx: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#2E7D32" d="M6 2h8l4 4v16H6z"/><path fill="#fff" d="M14 2v4h4"/><path fill="#fff" d="M9 11h2l1 1.7L13 11h2l-2 3 2 3h-2l-1-1.6L11 17H9l2-3z"/></svg>`,
    ppt: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EF6C00" d="M6 2h8l4 4v16H6z"/><path fill="#fff" d="M14 2v4h4"/><path fill="#fff" d="M9 11h2.5a1.8 1.8 0 1 1 0 3.6H10.2V17H9zm1.2 1.1v1.4h1.2a.7.7 0 1 0 0-1.4z"/></svg>`,
    pptx: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EF6C00" d="M6 2h8l4 4v16H6z"/><path fill="#fff" d="M14 2v4h4"/><path fill="#fff" d="M9 11h2.5a1.8 1.8 0 1 1 0 3.6H10.2V17H9zm1.2 1.1v1.4h1.2a.7.7 0 1 0 0-1.4z"/></svg>`,
    zip: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#6A1B9A" d="M6 2h8l4 4v16H6z"/><path fill="#fff" d="M14 2v4h4"/><path fill="#fff" d="M11 10h2v2h-2zm0 3h2v2h-2zm0 3h2v2h-2z"/></svg>`,
    txt: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#546E7A" d="M6 2h8l4 4v16H6z"/><path fill="#fff" d="M14 2v4h4"/><path fill="#fff" d="M8 11h8v1.5H8zm0 3h8v1.5H8zm0 3h5v1.5H8z"/></svg>`,
    csv: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#00897B" d="M6 2h8l4 4v16H6z"/><path fill="#fff" d="M14 2v4h4"/><path fill="#fff" d="M8 11h8v1.5H8zm0 3h8v1.5H8zm0 3h5v1.5H8z"/></svg>`,
    default: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#455A64" d="M6 2h8l4 4v16H6z"/><path fill="#fff" d="M14 2v4h4"/><path fill="#fff" d="M8 12h8v1.5H8zm0 3h6v1.5H8z"/></svg>`
  };
  const IMAGE_PREVIEW_TYPES = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];
  const TEXT_PREVIEW_TYPES = ["txt", "md", "csv", "json", "xml", "log"];
  const PDF_PREVIEW_TYPES = ["pdf"];

  function normalizeType(resource) {
    const t = String(resource.type || "").toLowerCase().trim();
    return t || "default";
  }

  function setLoading(isLoading) {
    loader.hidden = !isLoading;
  }

  function fillSelect(select, options) {
    const current = select.value;
    const first = select.firstElementChild ? select.firstElementChild.cloneNode(true) : null;
    select.innerHTML = "";
    if (first) select.appendChild(first);
    options.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    if ([...select.options].some((option) => option.value === current)) {
      select.value = current;
    }
  }

  function queryParams(path) {
    const params = new URLSearchParams();
    if (path) params.set("path", path);
    const search = searchInput.value.trim();
    if (search) params.set("search", search);
    if (categoryFilter.value) params.set("category", categoryFilter.value);
    if (typeFilter.value) params.set("type", typeFilter.value);
    return params.toString();
  }

  async function loadFolder(path) {
    setLoading(true);
    try {
      const response = await fetch(`${BROWSER_ENDPOINT}?${queryParams(path)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load resources");
      const payload = await response.json();
      state = {
        path: payload.currentPath || "",
        folders: Array.isArray(payload.folders) ? payload.folders : [],
        files: Array.isArray(payload.files) ? payload.files : [],
        breadcrumbs: Array.isArray(payload.breadcrumbs) ? payload.breadcrumbs : [],
        filters: payload.filters || { categories: [], types: [] }
      };
      fillSelect(categoryFilter, state.filters.categories || []);
      fillSelect(typeFilter, state.filters.types || []);
      render();
    } finally {
      setLoading(false);
    }
  }

  function renderBreadcrumbs() {
    breadcrumbs.innerHTML = "";
    state.breadcrumbs.forEach((crumb, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "resource-crumb-btn";
      button.textContent = crumb.label;
      button.disabled = index === state.breadcrumbs.length - 1;
      button.addEventListener("click", () => loadFolder(crumb.path));
      breadcrumbs.appendChild(button);

      if (index < state.breadcrumbs.length - 1) {
        const sep = document.createElement("span");
        sep.className = "resource-crumb-sep";
        sep.textContent = "›";
        breadcrumbs.appendChild(sep);
      }
    });
  }

  function renderFolders() {
    foldersGrid.innerHTML = "";
    state.folders.forEach((folder) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "resource-folder-item";
      button.innerHTML = `<i class="fa-solid fa-folder" aria-hidden="true"></i><span>${folder.name}</span>`;
      button.addEventListener("click", () => loadFolder(folder.path));
      foldersGrid.appendChild(button);
    });
    folderEmpty.hidden = state.folders.length > 0;
  }

  function setProgress(button, percent, indeterminate) {
    const ring = button.querySelector(".resource-progress-ring");
    const label = button.querySelector(".resource-progress-label");
    if (!ring || !label) return;

    if (indeterminate) {
      ring.classList.add("indeterminate");
      label.textContent = "…";
      return;
    }

    ring.classList.remove("indeterminate");
    const value = Math.max(0, Math.min(100, percent));
    const circumference = 2 * Math.PI * 9;
    const offset = circumference - (value / 100) * circumference;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(offset);
    label.textContent = `${Math.round(value)}%`;
  }

  function animateProgress(button, from, to, duration) {
    const start = performance.now();
    const distance = to - from;

    return new Promise((resolve) => {
      function frame(now) {
        const elapsed = now - start;
        const progress = duration > 0 ? Math.min(elapsed / duration, 1) : 1;
        const eased = 1 - Math.pow(1 - progress, 3);
        setProgress(button, from + distance * eased, false);
        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          resolve();
        }
      }

      requestAnimationFrame(frame);
    });
  }

  function resetDownloadButton(button) {
    button.disabled = false;
    button.classList.remove("is-downloading");
    const spinner = button.querySelector(".resource-spinner");
    const label = button.querySelector(".resource-btn-label");
    const progress = button.querySelector(".resource-progress-wrap");
    if (spinner) spinner.hidden = true;
    if (label) {
      label.hidden = false;
      label.textContent = "Download";
    }
    if (progress) progress.hidden = true;
    setProgress(button, 0, false);
  }

  function previewKindForFile(file) {
    const type = normalizeType(file);
    if (IMAGE_PREVIEW_TYPES.includes(type)) return "image";
    if (PDF_PREVIEW_TYPES.includes(type)) return "pdf";
    if (TEXT_PREVIEW_TYPES.includes(type)) return "text";
    return "unsupported";
  }

  function closePreviewModal() {
    previewModal.hidden = true;
    previewBody.innerHTML = "";
    previewDialog.dataset.previewKind = "";
    activePreviewFile = null;
    resetDownloadButton(modalDownloadBtn);
    if (previewTrigger) {
      previewTrigger.focus();
      previewTrigger = null;
    }
  }

  function showPreviewPlaceholder(message, isLoading, iconClass) {
    previewBody.innerHTML = `
      <div class="resource-preview-placeholder">
        ${isLoading ? '<span class="resource-inline-spinner" aria-hidden="true"></span>' : ""}
        ${iconClass ? `<i class="${iconClass}" aria-hidden="true"></i>` : ""}
        <p>${message}</p>
      </div>
    `;
  }

  function renderPreviewContent(file, previewUrl) {
    const kind = previewKindForFile(file);
    previewDialog.dataset.previewKind = kind;
    previewBody.innerHTML = "";

    if (kind === "unsupported") {
      showPreviewPlaceholder("No preview available. Please download this file.", false, "fa-solid fa-circle-exclamation");
      return;
    }

    if (kind === "image") {
      const image = document.createElement("img");
      image.src = previewUrl;
      image.alt = file.name || "Preview image";
      image.className = "resource-preview-image";
      previewBody.appendChild(image);
      return;
    }

    const frame = document.createElement("iframe");
    frame.src = previewUrl;
    frame.className = "resource-preview-frame";
    frame.title = file.name ? `${file.name} preview` : "Resource preview";
    previewBody.appendChild(frame);
  }

  async function previewResource(file, triggerButton) {
    previewTrigger = triggerButton || null;
    activePreviewFile = file;
    previewTitle.textContent = file.name || "Preview";
    previewDialog.dataset.previewKind = previewKindForFile(file);
    previewModal.hidden = false;
    if (previewKindForFile(file) === "unsupported") {
      showPreviewPlaceholder("No preview available. Please download this file.", false, "fa-solid fa-circle-exclamation");
      return;
    }
    showPreviewPlaceholder("Loading preview…", true);
    try {
      const response = await fetch(`${FILE_ENDPOINT}?id=${encodeURIComponent(file.id)}&action=preview`, { cache: "no-store" });
      if (!response.ok) throw new Error("Preview unavailable");
      const payload = await response.json();
      if (!payload.previewUrl) throw new Error("Preview unavailable");
      renderPreviewContent(file, payload.previewUrl);
    } catch (error) {
      showPreviewPlaceholder("No preview available. Please download this file.", false, "fa-solid fa-circle-exclamation");
    }
  }

  function filenameFromResource(resource) {
    return String(resource?.name || "resource").replace(/[\\/\r\n]/g, "-").trim() || "resource";
  }

  async function downloadResource(resource, button) {
    const resourceId = resource?.id || resource;
    const endpoint = `${FILE_ENDPOINT}?id=${encodeURIComponent(resourceId)}&action=download`;
    button.disabled = true;
    button.classList.add("is-downloading");
    const spinner = button.querySelector(".resource-spinner");
    const label = button.querySelector(".resource-btn-label");
    const progress = button.querySelector(".resource-progress-wrap");
    if (spinner) spinner.hidden = true;
    if (label) label.hidden = true;
    if (progress) progress.hidden = false;
    setProgress(button, 0, false);

    try {
      const response = await fetch(endpoint);
      if (!response.ok || !response.body) throw new Error("Stream unavailable");

      const total = Number(response.headers.get("content-length") || resource?.sizeBytes || 0);
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      let displayedProgress = 0;

      if (!total) setProgress(button, 0, true);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) {
          const targetProgress = Math.min((received / total) * 100, 92);
          if (targetProgress - displayedProgress >= 8) {
            await animateProgress(button, displayedProgress, targetProgress, 180);
          } else {
            setProgress(button, targetProgress, false);
          }
          displayedProgress = targetProgress;
        }
      }

      await animateProgress(button, total ? displayedProgress : 0, 100, total ? 750 : 1000);
      await new Promise((resolve) => setTimeout(resolve, 450));
      const blob = new Blob(chunks);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filenameFromResource(resource);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setProgress(button, 0, false);
    } finally {
      resetDownloadButton(button);
    }
  }

  function createFileCard(file) {
    const type = normalizeType(file);
    const card = document.createElement("article");
    card.className = "resource-card";
    card.innerHTML = `
      <div class="resource-icon" aria-hidden="true">${FILE_TYPE_ICONS[type] || FILE_TYPE_ICONS.default}</div>
      <div class="resource-meta">
        <h3>${file.name || "Untitled resource"}</h3>
        <p>${file.description || ""}</p>
        <div class="resource-tags">
          ${file.category ? `<span>${file.category}</span>` : ""}
          <span>${type.toUpperCase()}</span>
          ${file.size ? `<span>${file.size}</span>` : ""}
        </div>
      </div>
      <div class="resource-actions">
        <button class="resource-preview-btn" type="button">Preview</button>
        <button class="resource-download-btn" type="button" aria-label="Download ${file.name || "resource"}">
          <span class="resource-btn-label">Download</span>
          <span class="resource-spinner" hidden aria-hidden="true"></span>
          <span class="resource-progress-wrap" hidden aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle class="resource-progress-bg" cx="12" cy="12" r="9"></circle>
              <circle class="resource-progress-ring" cx="12" cy="12" r="9"></circle>
            </svg>
            <span class="resource-progress-label">0%</span>
          </span>
        </button>
      </div>
    `;
    const previewBtn = card.querySelector(".resource-preview-btn");
    const downloadBtn = card.querySelector(".resource-download-btn");
    previewBtn.addEventListener("click", () => previewResource(file, previewBtn));
    downloadBtn.addEventListener("click", () => downloadResource(file, downloadBtn));
    return card;
  }

  function renderFiles() {
    filesGrid.innerHTML = "";
    state.files.forEach((file) => filesGrid.appendChild(createFileCard(file)));
    resultsCount.textContent = `${state.files.length} file${state.files.length === 1 ? "" : "s"} in this folder`;
    emptyState.hidden = state.files.length > 0;
  }

  function render() {
    renderBreadcrumbs();
    renderFolders();
    renderFiles();
  }

  function bindEvents() {
    [searchInput, categoryFilter, typeFilter].forEach((element) => {
      element.addEventListener("input", () => loadFolder(state.path));
      element.addEventListener("change", () => loadFolder(state.path));
    });

    if (!modalEventBindingsDone) {
      previewCloseBtn.addEventListener("click", closePreviewModal);
      previewModal.addEventListener("click", (event) => {
        if (event.target === previewModal) {
          closePreviewModal();
        }
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !previewModal.hidden) {
          closePreviewModal();
        }
      });
      modalDownloadBtn.addEventListener("click", () => {
        if (!activePreviewFile || !activePreviewFile.id) return;
        downloadResource(activePreviewFile, modalDownloadBtn);
      });
      modalEventBindingsDone = true;
    }
  }

  async function init() {
    bindEvents();
    try {
      await loadFolder("");
    } catch (error) {
      setLoading(false);
      resultsCount.textContent = "";
      folderEmpty.hidden = true;
      emptyState.hidden = false;
      emptyState.textContent = "Unable to load resources right now.";
    }
  }

  init();
})();
