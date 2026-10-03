const fs = require("fs/promises");
const path = require("path");
const { getStore } = require("@netlify/blobs");

const STORE_NAME = "rm-tutoring-articles";
const STORE_KEY = "articles.json";
const LOCAL_DATA_PATH = path.join(__dirname, "..", "..", "data", "articles.json");
const LOCAL_IMAGE_DIR = path.join(__dirname, "..", "..", "data", "article-images");

const seedArticles = [
  {
    id: "getting-ready-for-calculus",
    slug: "getting-ready-for-calculus",
    title: "Getting Ready for Calculus",
    excerpt: "A short checklist for students reviewing algebra, functions, and trigonometry before starting calculus.",
    category: "Study Skills",
    tags: ["calculus", "pre-calculus", "study skills"],
    status: "published",
    content: "<p>Strong calculus students usually have strong fundamentals. Before your course begins, review function notation, graph transformations, exponent rules, logarithms, trigonometric identities, and factoring.</p><p>When those tools feel automatic, limits and derivatives become much easier to understand instead of feeling like a brand-new language.</p>",
    createdAt: "2025-01-01T12:00:00.000Z",
    updatedAt: "2025-01-01T12:00:00.000Z"
  }
];

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function sanitizeText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim();
}

function sanitizeHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

function makeAssetId(name = "article-image") {
  const safeName = slugify(path.parse(name).name) || "article-image";
  return `${safeName}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => sanitizeText(tag)).filter(Boolean).slice(0, 8);
  }

  return String(value || "")
    .split(",")
    .map((tag) => sanitizeText(tag))
    .filter(Boolean)
    .slice(0, 8);
}

function publicArticle(article) {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    tags: article.tags,
    status: article.status,
    content: article.content,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt
  };
}

function getArticleStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || process.env.NETLIFY_SITE_ID || process.env.SITE_ID || "";
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN || "";
  const options = { name: STORE_NAME, consistency: "strong" };

  if (siteID && token) {
    options.siteID = siteID;
    options.token = token;
  }

  return getStore(options);
}

async function readFromBlobStore() {
  return getArticleStore().get(STORE_KEY, { type: "json" });
}

async function writeToBlobStore(articles) {
  await getArticleStore().setJSON(STORE_KEY, articles);
}

async function readFromLocalFile() {
  try {
    const raw = await fs.readFile(LOCAL_DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : seedArticles;
  } catch {
    return seedArticles;
  }
}

async function writeToLocalFile(articles) {
  await fs.mkdir(path.dirname(LOCAL_DATA_PATH), { recursive: true });
  await fs.writeFile(LOCAL_DATA_PATH, JSON.stringify(articles, null, 2) + "\n", "utf8");
}

function canUseLocalFallback() {
  const isLambdaRuntime = Boolean(
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.LAMBDA_TASK_ROOT ||
    String(process.env.HOME || "").startsWith("/home/sbx_user")
  );

  return process.env.NETLIFY_DEV === "true" && !isLambdaRuntime;
}

async function readArticles() {
  try {
    const blobArticles = await readFromBlobStore();
    if (Array.isArray(blobArticles)) return blobArticles;
  } catch (error) {
    console.warn("Article blob read unavailable, using local fallback:", error.message);
  }

  return readFromLocalFile();
}

async function writeArticles(articles) {
  try {
    await writeToBlobStore(articles);
    return "blob";
  } catch (error) {
    if (!canUseLocalFallback()) {
      throw new Error(`Article storage is unavailable. Netlify Blobs failed before saving: ${error.message}`);
    }

    console.warn("Article blob write unavailable, using local fallback:", error.message);
    await writeToLocalFile(articles);
    return "local";
  }
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error("Only PNG, JPG, WEBP, and GIF image uploads are supported.");
  }

  return {
    contentType: match[1],
    base64: match[2]
  };
}

async function writeImageUpload(upload) {
  const parsed = parseDataUrl(upload.dataUrl);
  const id = makeAssetId(upload.name);
  const image = {
    id,
    name: sanitizeText(upload.name || id).slice(0, 120),
    contentType: parsed.contentType,
    base64: parsed.base64,
    createdAt: new Date().toISOString()
  };
  const key = `images/${id}.json`;

  try {
    await getArticleStore().setJSON(key, image);
    return { id, storage: "blob" };
  } catch (error) {
    if (!canUseLocalFallback()) {
      throw new Error(`Article image storage is unavailable. Netlify Blobs failed before uploading: ${error.message}`);
    }

    console.warn("Article image blob write unavailable, using local fallback:", error.message);
    await fs.mkdir(LOCAL_IMAGE_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_IMAGE_DIR, `${id}.json`), JSON.stringify(image), "utf8");
    return { id, storage: "local" };
  }
}

async function readImageUpload(id) {
  const safeId = String(id || "").replace(/[^a-z0-9-]/gi, "");
  if (!safeId) return null;

  try {
    const image = await getArticleStore().get(`images/${safeId}.json`, { type: "json" });
    if (image && image.base64 && image.contentType) return image;
  } catch (error) {
    console.warn("Article image blob read unavailable, using local fallback:", error.message);
  }

  try {
    const raw = await fs.readFile(path.join(LOCAL_IMAGE_DIR, `${safeId}.json`), "utf8");
    const image = JSON.parse(raw);
    return image && image.base64 && image.contentType ? image : null;
  } catch {
    return null;
  }
}

function normalizeArticle(input, existingArticles = []) {
  const now = new Date().toISOString();
  const current = existingArticles.find((article) => article.id === input.id) || {};
  const title = sanitizeText(input.title);

  if (!title) {
    throw new Error("Article title is required.");
  }

  const baseSlug = slugify(input.slug || title) || `article-${Date.now()}`;
  const duplicateSlug = existingArticles.some((article) => article.slug === baseSlug && article.id !== input.id);
  const slug = duplicateSlug ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;
  const id = current.id || slug || `article-${Date.now().toString(36)}`;

  return {
    id,
    slug,
    title,
    excerpt: sanitizeText(input.excerpt).slice(0, 260),
    category: sanitizeText(input.category || "Math Learning").slice(0, 80),
    tags: normalizeTags(input.tags),
    status: input.status === "draft" ? "draft" : "published",
    content: sanitizeHtml(input.content),
    createdAt: current.createdAt || now,
    updatedAt: now
  };
}

function sortArticles(articles) {
  return [...articles].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

module.exports = {
  jsonResponse,
  normalizeArticle,
  publicArticle,
  readImageUpload,
  readArticles,
  sortArticles,
  writeArticles,
  writeImageUpload
};
