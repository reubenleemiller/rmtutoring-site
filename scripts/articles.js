(function () {
  const ENDPOINT = "/.netlify/functions/articles";
  const INITIAL_PRELOAD_MS = 2000;
  const state = {
    articles: [],
    selectedSlug: new URLSearchParams(window.location.search).get("article") || ""
  };

  const grid = document.getElementById("articles-grid");
  const emptyState = document.getElementById("articles-empty-state");
  const searchInput = document.getElementById("article-search");
  const categoryFilter = document.getElementById("article-category-filter");
  const countEl = document.getElementById("article-count");
  const detail = document.getElementById("article-detail");
  const detailTitle = document.getElementById("article-detail-title");
  const detailMeta = document.getElementById("article-detail-meta");
  const detailBody = document.getElementById("article-detail-body");
  const closeDetailBtn = document.getElementById("article-detail-close");
  const detailActions = document.getElementById("article-detail-actions");
  const widgetLoader = document.getElementById("articles-widget-loader");
  const searchSpinner = document.getElementById("article-search-spinner");

  function setWidgetLoading(isLoading) {
    if (widgetLoader) widgetLoader.hidden = !isLoading;
  }

  function setSearchLoading(isLoading) {
    if (searchSpinner) searchSpinner.hidden = !isLoading;
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function formatDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(new Date(value));
  }

  function articleUrl(article) {
    return `article.html?article=${encodeURIComponent(article.slug)}`;
  }

  function textFromHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    return String(template.content.textContent || "").replace(/\s+/g, " ").trim();
  }

  function truncateText(value, maxLength = 210) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength).replace(/\s+\S*$/, "")}...`;
  }

  function makePreviewHtml(article) {
    const bodyText = textFromHtml(article.content);
    const source = [article.excerpt, bodyText].filter(Boolean).join(" ");
    const preview = truncateText(source || "This article is being prepared.", 1800);
    return `<p>${preview}</p><p class="article-preview-note">Open the full article for complete formatting, math, images, and figures.</p>`;
  }

  function articleMatches(article, query, category) {
    const haystack = [
      article.title,
      article.excerpt,
      article.category,
      ...(article.tags || []),
      article.content
    ].join(" ").toLowerCase();

    return (!query || haystack.includes(query)) && (!category || article.category === category);
  }

  function activeArticles() {
    const query = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;
    return state.articles.filter((article) => articleMatches(article, query, category));
  }

  function renderCategories() {
    const categories = [...new Set(state.articles.map((article) => article.category).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    categoryFilter.innerHTML = '<option value="">All categories</option>';
    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      categoryFilter.appendChild(option);
    });
  }

  function createArticleCard(article) {
    const card = document.createElement("article");
    card.className = "article-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Preview ${article.title}`);

    const tags = (article.tags || []).map((tag) => `<span>${tag}</span>`).join("");
    card.innerHTML = `
      <div class="article-card-topline">
        <span>${article.category || "Article"}</span>
        <time datetime="${article.updatedAt || ""}">${formatDate(article.updatedAt)}</time>
      </div>
      <h2>${article.title}</h2>
      <p>${truncateText(article.excerpt || textFromHtml(article.content) || "Open this article for tutoring insights and study support.", 180)}</p>
      <div class="article-tags">${tags}</div>
      <div class="article-card-actions">
        <button class="article-read-btn" type="button">
          <span>Preview Article</span>
          <i class="fa-solid fa-eye" aria-hidden="true"></i>
        </button>
        <button class="article-pdf-btn" type="button" data-card-download>
          <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
          <span>Download PDF</span>
          <span class="article-tiny-spinner article-button-spinner" hidden aria-hidden="true"></span>
        </button>
      </div>
    `;

    const pdfButton = card.querySelector("[data-card-download]");
    pdfButton.addEventListener("click", (event) => {
      event.stopPropagation();
      downloadArticle(article, pdfButton);
    });

    card.addEventListener("click", () => openArticle(article.slug, true));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openArticle(article.slug, true);
      }
    });

    return card;
  }

  function renderArticles() {
    const articles = activeArticles();
    grid.innerHTML = "";
    articles.forEach((article) => grid.appendChild(createArticleCard(article)));

    emptyState.hidden = articles.length > 0;
    countEl.textContent = `${articles.length} article${articles.length === 1 ? "" : "s"} found`;

    if (state.selectedSlug && !state.articles.some((article) => article.slug === state.selectedSlug)) {
      closeArticle();
    }
  }

  function openArticle(slug, updateUrl) {
    const article = state.articles.find((item) => item.slug === slug);
    if (!article) return;

    state.selectedSlug = slug;
    detailTitle.textContent = article.title;
    detailMeta.textContent = `${article.category || "Article"} - Preview - Updated ${formatDate(article.updatedAt)}`;
    detailBody.classList.add("is-preview");
    detailBody.innerHTML = makePreviewHtml(article);
    detailActions.innerHTML = `
      <a class="article-detail-read-btn button" href="${articleUrl(article)}">
        <i class="fa-solid fa-book-open" aria-hidden="true"></i>
        Read Article
      </a>
      <button class="article-pdf-btn" type="button" data-detail-download>
        <i class="fa-solid fa-file-lines" aria-hidden="true"></i>
        <span>Download PDF</span>
        <span class="article-tiny-spinner article-button-spinner" hidden aria-hidden="true"></span>
      </button>
    `;
    detailActions.querySelector("[data-detail-download]").addEventListener("click", (event) => {
      downloadArticle(article, event.currentTarget);
    });
    detail.hidden = false;
    detail.scrollIntoView({ behavior: "smooth", block: "start" });

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("article", slug);
      window.history.pushState({}, "", url);
    }
  }

  async function downloadArticle(article, button) {
    const spinner = button.querySelector(".article-tiny-spinner");
    if (spinner) spinner.hidden = true;
    button.classList.add("is-loading");
    button.disabled = true;
    if (window.RMArticleUI) {
      window.RMArticleUI.setButtonProgress(button, 0);
    }

    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await window.RMArticleTools.downloadArticlePdf(article, {
        logoPath: "../assets/logo.png",
        onProgress(percent) {
          if (window.RMArticleUI) window.RMArticleUI.setButtonProgress(button, percent);
        }
      });
    } catch (error) {
      await window.RMArticleUI.alert(error.message, { title: "PDF unavailable" });
    } finally {
      if (spinner) spinner.hidden = true;
      if (window.RMArticleUI) window.RMArticleUI.resetButtonProgress(button);
      button.classList.remove("is-loading");
      button.disabled = false;
    }
  }

  function closeArticle() {
    state.selectedSlug = "";
    detail.hidden = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("article");
    window.history.pushState({}, "", url);
  }

  async function loadArticles() {
    setWidgetLoading(true);

    try {
      await wait(INITIAL_PRELOAD_MS);
      const response = await fetch(ENDPOINT);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load articles.");
      }

      state.articles = data.articles || [];
      renderCategories();
      renderArticles();

      if (state.selectedSlug) {
        openArticle(state.selectedSlug, false);
      }
    } catch (error) {
      grid.innerHTML = "";
      emptyState.hidden = false;
      emptyState.textContent = error.message;
      countEl.textContent = "Article library unavailable";
      if (window.RMArticleUI) {
        window.RMArticleUI.alert(error.message, { title: "Article library unavailable" });
      }
    } finally {
      setWidgetLoading(false);
    }
  }

  let filterTimer;
  function scheduleRender() {
    setSearchLoading(true);
    window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(() => {
      renderArticles();
      setSearchLoading(false);
    }, 160);
  }

  searchInput.addEventListener("input", scheduleRender);
  categoryFilter.addEventListener("change", scheduleRender);
  closeDetailBtn.addEventListener("click", closeArticle);
  window.addEventListener("popstate", () => {
    state.selectedSlug = new URLSearchParams(window.location.search).get("article") || "";
    if (state.selectedSlug) openArticle(state.selectedSlug, false);
    else detail.hidden = true;
  });

  loadArticles();
})();
