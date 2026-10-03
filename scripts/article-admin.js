(function () {
  const ENDPOINT = "/.netlify/functions/article-admin";
  const PASSWORD_KEY = "rm_article_admin_password";
  const state = {
    password: sessionStorage.getItem(PASSWORD_KEY) || "",
    articles: [],
    editingId: ""
  };

  const loginForm = document.getElementById("article-admin-login");
  const passwordInput = document.getElementById("admin-password");
  const loginSpinner = document.getElementById("admin-login-spinner");
  const loginStatus = document.getElementById("admin-login-status");
  const workspace = document.getElementById("article-admin-workspace");
  const logoutBtn = document.getElementById("article-admin-logout");
  const newBtn = document.getElementById("article-new-btn");
  const exportBtn = document.getElementById("article-export-btn");
  const exportSpinner = document.getElementById("article-export-spinner");
  const articleList = document.getElementById("article-admin-list");
  const articleForm = document.getElementById("article-editor-form");
  const saveSpinner = document.getElementById("article-save-spinner");
  const saveStatus = document.getElementById("article-save-status");
  const editor = document.getElementById("article-content-editor");
  const widgetLoader = document.getElementById("article-admin-widget-loader");
  const inlineMathBtn = document.getElementById("article-inline-math-btn");
  const displayMathBtn = document.getElementById("article-display-math-btn");
  const imageBtn = document.getElementById("article-image-btn");
  const imageSpinner = document.getElementById("article-image-spinner");
  const imageInput = document.getElementById("article-image-upload");
  const imageAsFigure = document.getElementById("article-image-as-figure");
  const imageCaption = document.getElementById("article-image-caption");
  const preview = document.getElementById("article-content-preview");
  const previewStatus = document.getElementById("article-preview-status");

  const fields = {
    id: document.getElementById("article-id"),
    title: document.getElementById("article-title"),
    slug: document.getElementById("article-slug"),
    excerpt: document.getElementById("article-excerpt"),
    category: document.getElementById("article-category"),
    tags: document.getElementById("article-tags"),
    status: document.getElementById("article-status")
  };

  function setWidgetLoading(isLoading) {
    widgetLoader.hidden = !isLoading;
  }

  function setButtonLoading(spinner, isLoading) {
    if (spinner) spinner.hidden = !isLoading;
    const button = spinner ? spinner.closest("button") : null;
    if (button) button.classList.toggle("is-loading", isLoading);
  }

  function setStatus(element, message, isError) {
    element.textContent = message || "";
    element.classList.toggle("is-error", Boolean(isError));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function insertHtml(html) {
    editor.focus();
    document.execCommand("insertHTML", false, html);
    schedulePreview();
  }

  function getEditorSelectionText() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return "";
    const range = selection.getRangeAt(0);
    return editor.contains(range.commonAncestorContainer) ? selection.toString().trim() : "";
  }

  function insertMath(display) {
    const selected = getEditorSelectionText();
    const expression = selected || (display ? "\\int_a^b f(x)\\,dx = F(b)-F(a)" : "x^2 + y^2 = r^2");
    const escapedExpression = escapeHtml(expression);

    if (display) {
      insertHtml(`<p>\\[${escapedExpression}\\]</p><p><br></p>`);
    } else {
      insertHtml(`\\(${escapedExpression}\\)`);
    }
  }

  function renderMathInPreview() {
    if (!preview) return;
    preview.innerHTML = editor.innerHTML || "<p>Start writing to preview the article.</p>";

    if (typeof window.renderMathInElement !== "function") {
      if (previewStatus) {
        previewStatus.textContent = "KaTeX loading";
        previewStatus.classList.remove("is-error");
      }
      return;
    }

    try {
      window.renderMathInElement(preview, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false,
        errorColor: "#9b1c1c"
      });
      if (previewStatus) {
        previewStatus.textContent = "KaTeX rendered";
        previewStatus.classList.remove("is-error");
      }
    } catch (error) {
      if (previewStatus) {
        previewStatus.textContent = error.message || "KaTeX preview issue";
        previewStatus.classList.add("is-error");
      }
    }
  }

  let previewTimer;
  function schedulePreview() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(renderMathInPreview, 120);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Unable to read that image file."));
      reader.readAsDataURL(file);
    });
  }

  async function adminRequest(payload) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": state.password
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Admin request failed.");
    }

    return data;
  }

  function formatDate(value) {
    if (!value) return "Never";
    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value));
  }

  function exportFilename(exportedAt) {
    const date = new Date(exportedAt || Date.now());
    const stamp = Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10);
    return `rm-tutoring-articles-${stamp}.json`;
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearEditor() {
    state.editingId = "";
    fields.id.value = "";
    fields.title.value = "";
    fields.slug.value = "";
    fields.excerpt.value = "";
    fields.category.value = "Math Learning";
    fields.tags.value = "";
    fields.status.value = "published";
    editor.innerHTML = "<p>Write the article body here.</p>";
    schedulePreview();
    fields.title.focus();
  }

  function editArticle(article) {
    state.editingId = article.id;
    fields.id.value = article.id;
    fields.title.value = article.title || "";
    fields.slug.value = article.slug || "";
    fields.excerpt.value = article.excerpt || "";
    fields.category.value = article.category || "";
    fields.tags.value = (article.tags || []).join(", ");
    fields.status.value = article.status || "published";
    editor.innerHTML = article.content || "";
    schedulePreview();
    fields.title.focus();
  }

  function renderArticleList() {
    articleList.innerHTML = "";

    if (!state.articles.length) {
      articleList.innerHTML = '<p class="article-admin-empty">No articles yet. Create the first one.</p>';
      return;
    }

    const table = document.createElement("table");
    table.className = "article-admin-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th scope="col">Title</th>
          <th scope="col">Category</th>
          <th scope="col">Status</th>
          <th scope="col">Updated</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    state.articles.forEach((article) => {
      const row = document.createElement("tr");
      const title = escapeHtml(article.title || "Untitled article");
      const slug = escapeHtml(article.slug || "");
      const category = escapeHtml(article.category || "Article");
      const status = escapeHtml(article.status || "draft");
      const updated = escapeHtml(formatDate(article.updatedAt));

      row.innerHTML = `
        <td>
          <strong>${title}</strong>
          <span>${slug}</span>
        </td>
        <td>${category}</td>
        <td><span class="article-admin-status">${status}</span></td>
        <td>${updated}</td>
        <td>
          <div class="article-admin-item-actions">
            <button type="button" class="article-edit-btn">
              <i class="fa-solid fa-pen" aria-hidden="true"></i>
              <span>Edit</span>
            </button>
            <button type="button" class="article-delete-btn">
              <i class="fa-solid fa-trash" aria-hidden="true"></i>
              <span>Delete</span>
            </button>
          </div>
        </td>
      `;

      row.querySelector(".article-edit-btn").addEventListener("click", () => editArticle(article));
      row.querySelector(".article-delete-btn").addEventListener("click", () => deleteArticle(article));
      tbody.appendChild(row);
    });

    articleList.appendChild(table);
  }

  async function loadAdminArticles() {
    setWidgetLoading(true);
    try {
      const data = await adminRequest({ action: "list" });
      state.articles = data.articles || [];
      workspace.hidden = false;
      loginForm.hidden = true;
      renderArticleList();
      if (!state.editingId) clearEditor();
    } finally {
      setWidgetLoading(false);
    }
  }

  async function deleteArticle(article) {
    const deleted = await window.RMArticleUI.confirm(`Delete "${article.title}"? This cannot be undone from the browser.`, {
      title: "Delete article",
      confirmText: "Delete",
      cancelText: "Keep Article",
      danger: true,
      onConfirm: async () => {
        setWidgetLoading(true);
        setStatus(saveStatus, "");
        try {
          await adminRequest({ action: "delete", id: article.id });
          state.articles = state.articles.filter((item) => item.id !== article.id);
          renderArticleList();
          if (state.editingId === article.id) clearEditor();
          setStatus(saveStatus, "Article deleted.");
        } catch (error) {
          setStatus(saveStatus, error.message, true);
          throw error;
        } finally {
          setWidgetLoading(false);
        }
      }
    });

    if (deleted) {
      window.RMArticleUI.alert("Article deleted.", { title: "Deleted" });
    }
  }

  function getArticlePayload() {
    return {
      id: fields.id.value,
      title: fields.title.value,
      slug: fields.slug.value,
      excerpt: fields.excerpt.value,
      category: fields.category.value,
      tags: fields.tags.value,
      status: fields.status.value,
      content: editor.innerHTML
    };
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    state.password = passwordInput.value.trim();
    setButtonLoading(loginSpinner, true);
    setStatus(loginStatus, "");

    try {
      await loadAdminArticles();
      sessionStorage.setItem(PASSWORD_KEY, state.password);
      passwordInput.value = "";
    } catch (error) {
      sessionStorage.removeItem(PASSWORD_KEY);
      setStatus(loginStatus, error.message, true);
      window.RMArticleUI.alert(error.message, { title: "Login failed" });
    } finally {
      setButtonLoading(loginSpinner, false);
    }
  });

  articleForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setButtonLoading(saveSpinner, true);
    setStatus(saveStatus, "");

    try {
      const data = await adminRequest({ action: "save", article: getArticlePayload() });
      const nextArticles = state.articles.filter((article) => article.id !== data.article.id);
      nextArticles.unshift(data.article);
      state.articles = nextArticles;
      fields.id.value = data.article.id;
      state.editingId = data.article.id;
      renderArticleList();
      setStatus(saveStatus, `Saved. Storage: ${data.storage}.`);
      window.RMArticleUI.alert(`Saved. Storage: ${data.storage}.`, { title: "Article saved" });
    } catch (error) {
      setStatus(saveStatus, error.message, true);
      window.RMArticleUI.alert(error.message, { title: "Save failed" });
    } finally {
      setButtonLoading(saveSpinner, false);
    }
  });

  exportBtn.addEventListener("click", async () => {
    setButtonLoading(exportSpinner, true);
    exportBtn.disabled = true;
    setStatus(saveStatus, "");

    try {
      const data = await adminRequest({ action: "export" });
      const exportData = {
        exportedAt: data.exportedAt,
        articles: data.articles || []
      };
      downloadJson(exportFilename(data.exportedAt), exportData);
      setStatus(saveStatus, `Exported ${exportData.articles.length} article${exportData.articles.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setStatus(saveStatus, error.message, true);
      window.RMArticleUI.alert(error.message, { title: "Export failed" });
    } finally {
      setButtonLoading(exportSpinner, false);
      exportBtn.disabled = false;
    }
  });

  document.querySelectorAll("[data-editor-command]").forEach((button) => {
    button.addEventListener("click", () => {
      editor.focus();
      document.execCommand(button.dataset.editorCommand, false, null);
    });
  });

  document.getElementById("article-format-block").addEventListener("change", (event) => {
    editor.focus();
    document.execCommand("formatBlock", false, event.target.value);
    event.target.value = "";
  });

  inlineMathBtn.addEventListener("click", () => {
    insertMath(false);
  });

  displayMathBtn.addEventListener("click", () => {
    insertMath(true);
  });

  imageBtn.addEventListener("click", () => {
    imageInput.click();
  });

  imageInput.addEventListener("change", async () => {
    const file = imageInput.files && imageInput.files[0];
    imageInput.value = "";
    if (!file) return;

    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
      window.RMArticleUI.alert("Please choose a PNG, JPG, WEBP, or GIF image.", { title: "Unsupported image" });
      return;
    }

    setButtonLoading(imageSpinner, true);
    imageBtn.disabled = true;
    try {
      const dataUrl = await fileToDataUrl(file);
      const data = await adminRequest({
        action: "uploadImage",
        image: {
          name: file.name,
          dataUrl
        }
      });

      const caption = imageCaption.value.trim();
      const escapedCaption = escapeHtml(caption);
      const escapedUrl = escapeHtml(data.image.url);
      const escapedAlt = escapeHtml(caption || file.name.replace(/\.[^.]+$/, ""));
      const imageHtml = `<img src="${escapedUrl}" alt="${escapedAlt}">`;

      if (imageAsFigure.checked || caption) {
        insertHtml(`<figure>${imageHtml}${caption ? `<figcaption>${escapedCaption}</figcaption>` : ""}</figure><p><br></p>`);
      } else {
        insertHtml(`${imageHtml}<p><br></p>`);
      }

      imageCaption.value = "";
      schedulePreview();
      window.RMArticleUI.alert("Image added to the article body.", { title: "Image uploaded" });
    } catch (error) {
      window.RMArticleUI.alert(error.message, { title: "Image upload failed" });
    } finally {
      setButtonLoading(imageSpinner, false);
      imageBtn.disabled = false;
    }
  });

  editor.addEventListener("input", schedulePreview);
  editor.addEventListener("paste", () => {
    window.setTimeout(schedulePreview, 0);
  });

  newBtn.addEventListener("click", clearEditor);
  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem(PASSWORD_KEY);
    state.password = "";
    workspace.hidden = true;
    loginForm.hidden = false;
    passwordInput.focus();
  });

  if (state.password) {
    loadAdminArticles().catch(() => {
      sessionStorage.removeItem(PASSWORD_KEY);
      state.password = "";
      workspace.hidden = true;
      loginForm.hidden = false;
    });
  }
})();
