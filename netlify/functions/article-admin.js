const {
  jsonResponse,
  normalizeArticle,
  publicArticle,
  readArticles,
  sortArticles,
  writeArticles,
  writeImageUpload
} = require("./_article-store");

function getAdminPassword(event) {
  const configuredPassword = process.env.ARTICLE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "";
  const host = event.headers.host || "";

  if (configuredPassword) return configuredPassword;
  if (process.env.NETLIFY_DEV === "true" || host.includes("localhost") || host.includes("127.0.0.1")) {
    return "local-test-password";
  }

  return "";
}

function readPassword(event, payload) {
  return event.headers["x-admin-password"] || payload.password || "";
}

function parseBody(event) {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return {};
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { success: false, error: "Method Not Allowed" });
  }

  const payload = parseBody(event);
  const configuredPassword = getAdminPassword(event);

  if (!configuredPassword) {
    return jsonResponse(500, {
      success: false,
      error: "Article admin password is not configured. Set ARTICLE_ADMIN_PASSWORD in Netlify."
    });
  }

  if (readPassword(event, payload) !== configuredPassword) {
    return jsonResponse(403, { success: false, error: "Incorrect admin password." });
  }

  try {
    const action = payload.action || "list";
    const articles = await readArticles();

    if (action === "list") {
      return jsonResponse(200, {
        success: true,
        articles: sortArticles(articles).map(publicArticle)
      });
    }

    if (action === "export") {
      return jsonResponse(200, {
        success: true,
        exportedAt: new Date().toISOString(),
        articles: sortArticles(articles).map(publicArticle)
      });
    }

    if (action === "save") {
      const article = normalizeArticle(payload.article || {}, articles);
      const nextArticles = articles.filter((item) => item.id !== article.id);
      nextArticles.push(article);
      const storage = await writeArticles(sortArticles(nextArticles));

      return jsonResponse(200, {
        success: true,
        article: publicArticle(article),
        storage
      });
    }

    if (action === "delete") {
      const id = String(payload.id || "").trim();
      const nextArticles = articles.filter((article) => article.id !== id);

      if (nextArticles.length === articles.length) {
        return jsonResponse(404, { success: false, error: "Article not found." });
      }

      const storage = await writeArticles(nextArticles);
      return jsonResponse(200, { success: true, storage });
    }

    if (action === "uploadImage") {
      const result = await writeImageUpload(payload.image || {});
      return jsonResponse(200, {
        success: true,
        image: {
          id: result.id,
          url: `/.netlify/functions/article-image?id=${encodeURIComponent(result.id)}`
        },
        storage: result.storage
      });
    }

    return jsonResponse(400, { success: false, error: "Unknown admin action." });
  } catch (error) {
    console.error("article-admin failed:", error.message);
    return jsonResponse(500, { success: false, error: error.message || "Article admin failed." });
  }
};
