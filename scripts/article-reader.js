(function () {
  const ENDPOINT = "/.netlify/functions/articles";
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("article") || params.get("slug") || "";
  const state = { article: null };

  const loader = document.getElementById("article-reader-loader");
  const page = document.getElementById("article-reader-page");
  const empty = document.getElementById("article-reader-empty");
  const title = document.getElementById("article-reader-title");
  const meta = document.getElementById("article-reader-meta");
  const excerpt = document.getElementById("article-reader-excerpt");
  const body = document.getElementById("article-reader-body");
  const downloadButtons = document.querySelectorAll("[data-download-article-pdf]");

  function setLoading(isLoading) {
    loader.hidden = !isLoading;
  }

  function showEmpty(message) {
    empty.textContent = message;
    empty.hidden = false;
    page.hidden = true;
  }

  function renderArticle(article) {
    state.article = article;
    document.title = `${article.title} | RM Tutoring Services`;
    title.textContent = article.title;
    meta.textContent = `${article.category || "Article"} - Published ${window.RMArticleTools.formatDateTime(article.createdAt || article.updatedAt)}`;
    excerpt.textContent = article.excerpt || "";
    excerpt.hidden = !article.excerpt;
    body.innerHTML = article.content || "<p>This article is being prepared.</p>";
    page.hidden = false;
    empty.hidden = true;
    window.RMArticleTools.renderMath(body);
  }

  async function loadArticle() {
    setLoading(true);
    try {
      const response = await fetch(ENDPOINT);
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to load article.");

      const article = (data.articles || []).find((item) => item.slug === slug);
      if (!article) {
        showEmpty("Article not found.");
        return;
      }
      renderArticle(article);
    } catch (error) {
      showEmpty(error.message);
    } finally {
      setLoading(false);
    }
  }

  downloadButtons.forEach((button) => {
    const spinner = button.querySelector(".article-tiny-spinner");
    button.addEventListener("click", async () => {
      if (!state.article) return;
      if (spinner) spinner.hidden = true;
      button.classList.add("is-loading");
      button.disabled = true;
      if (window.RMArticleUI) {
        window.RMArticleUI.setButtonProgress(button, 0);
      }

      try {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await window.RMArticleTools.downloadArticlePdf(state.article, {
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
    });
  });

  loadArticle();
})();
