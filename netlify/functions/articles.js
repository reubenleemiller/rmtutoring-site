const { jsonResponse, publicArticle, readArticles, sortArticles } = require("./_article-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { success: false, error: "Method Not Allowed" });
  }

  try {
    const allArticles = await readArticles();
    const articles = sortArticles(allArticles)
      .filter((article) => article.status === "published")
      .map(publicArticle);

    return jsonResponse(200, { success: true, articles });
  } catch (error) {
    console.error("articles failed:", error.message);
    return jsonResponse(500, { success: false, error: "Failed to load articles." });
  }
};
