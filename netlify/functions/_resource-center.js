const { Storage } = require("@google-cloud/storage");

const DEFAULT_SIGNED_URL_TTL_SECONDS = 900;

const DEMO_RESOURCES = [
  {
    id: "calculus-midterm-review",
    name: "Calculus Midterm Review",
    description: "Practice problems and worked solutions for limits and derivatives.",
    category: "Calculus I",
    folderPath: "Calculus I/Midterm Prep",
    type: "pdf",
    size: "2.3 MB",
    updatedAt: "2026-05-01",
    gcsPath: "gs://example-bucket/calculus-i/midterm-review.pdf"
  },
  {
    id: "integration-formulas-sheet",
    name: "Integration Formulas Sheet",
    description: "Compact formula sheet for substitution and integration by parts.",
    category: "Calculus II",
    folderPath: "Calculus II/Formula Sheets",
    type: "docx",
    size: "356 KB",
    updatedAt: "2026-04-23",
    gcsPath: "gs://example-bucket/calculus-ii/formulas/integration-formulas.docx"
  },
  {
    id: "vector-fields-quiz-pack",
    name: "Vector Fields Quiz Pack",
    description: "Quiz and answer key focused on gradient, divergence, and curl.",
    category: "Calculus III",
    folderPath: "Calculus III/Quiz Packs",
    type: "zip",
    size: "5.1 MB",
    updatedAt: "2026-04-19",
    gcsPath: "gs://example-bucket/calculus-iii/quizzes/vector-fields-pack.zip"
  }
];

let storageClient;

/**
 * Returns the configured bucket using common aliases in priority order:
 * RESOURCE_CENTER_GCS_BUCKET -> RESOURCE_CENTER_BUCKET -> GCS_BUCKET -> GOOGLE_CLOUD_STORAGE_BUCKET.
 */
function getEnv(name) {
  if (typeof Netlify !== "undefined" && Netlify.env?.get) {
    const value = Netlify.env.get(name);
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return process.env[name];
}

function parseBucketConfig(rawValue) {
  let value = String(rawValue || "").trim();
  if (!value) return { bucket: "", prefix: "" };

  value = value.replace(/^["']|["']$/g, "");

  try {
    const url = new URL(value);
    if (url.protocol === "gs:") {
      return {
        bucket: url.hostname,
        prefix: normalizePath(url.pathname)
      };
    }

    if (url.protocol === "https:" && url.hostname === "storage.googleapis.com") {
      const [bucket, ...prefixParts] = normalizePath(decodeURIComponent(url.pathname)).split("/");
      return {
        bucket: bucket || "",
        prefix: normalizePath(prefixParts.join("/"))
      };
    }

    if (url.protocol === "https:" && url.hostname.endsWith(".storage.googleapis.com")) {
      return {
        bucket: url.hostname.replace(/\.storage\.googleapis\.com$/i, ""),
        prefix: normalizePath(decodeURIComponent(url.pathname))
      };
    }
  } catch (error) {
    // Plain bucket names and bucket/prefix values are handled below.
  }

  value = value.replace(/^gs:\/\//i, "");
  const [bucket, ...prefixParts] = normalizePath(value).split("/");
  return {
    bucket: bucket || "",
    prefix: normalizePath(prefixParts.join("/"))
  };
}

function getConfiguredBucket() {
  const rawBucket = String(
    getEnv("RESOURCE_CENTER_GCS_BUCKET") ||
      getEnv("RESOURCE_CENTER_BUCKET") ||
      getEnv("GCS_BUCKET") ||
      getEnv("GOOGLE_CLOUD_STORAGE_BUCKET") ||
      ""
  ).trim();
  const parsed = parseBucketConfig(rawBucket);
  const extraPrefix = normalizePath(
    getEnv("RESOURCE_CENTER_GCS_PREFIX") ||
      getEnv("RESOURCE_CENTER_BUCKET_PREFIX") ||
      getEnv("GCS_PREFIX") ||
      ""
  );
  return {
    bucket: parsed.bucket,
    prefix: normalizePath([parsed.prefix, extraPrefix].filter(Boolean).join("/"))
  };
}

function getConfiguredBucketName() {
  return getConfiguredBucket().bucket;
}

function stripConfiguredPrefix(objectName, prefix) {
  const rawObject = String(objectName || "").replace(/\\/g, "/").trim();
  const normalizedObject = normalizePath(rawObject);
  const normalizedPrefix = normalizePath(prefix);
  if (!normalizedPrefix) return rawObject;
  if (normalizedObject === normalizedPrefix) return rawObject.endsWith("/") ? "/" : "";
  if (!normalizedObject.startsWith(`${normalizedPrefix}/`)) return "";

  const relative = normalizedObject.slice(normalizedPrefix.length + 1);
  return rawObject.endsWith("/") && relative ? `${relative}/` : relative;
}

function getCredentialJson() {
  const rawCredentials =
    getEnv("RESOURCE_CENTER_GCP_SERVICE_ACCOUNT_JSON") ||
    getEnv("GCP_SERVICE_ACCOUNT_JSON") ||
    getEnv("GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON");
  const rawValue = String(rawCredentials || "").trim();
  if (!rawValue) return "";

  if (rawValue.startsWith("{")) return rawValue;

  try {
    return Buffer.from(rawValue, "base64").toString("utf8");
  } catch (error) {
    return rawValue;
  }
}

function hasCredentialJson() {
  return Boolean(getCredentialJson());
}

function getEnvValue(name) {
  return String(
    getEnv(name) ||
      ""
  ).trim();
}

function normalizePath(input) {
  const path = String(input || "").replace(/\\/g, "/").trim();
  if (!path || path === "/") return "";
  const segments = path
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => segment !== "." && segment !== "..");
  return segments.join("/");
}

function inferType(entry) {
  const type = String(entry.type || "").toLowerCase().trim();
  if (type) return type;
  const source = String(entry.downloadUrl || entry.gcsPath || entry.objectPath || entry.object || "");
  const ext = source.toLowerCase().split("?")[0].split("#")[0].split(".").pop();
  return ext || "default";
}

function toUrlSafeBase64(value) {
  return Buffer.from(String(value || ""))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function toResourceEntry(entry, index) {
  const folderPath = normalizePath(entry.folderPath || entry.path || entry.folder || "");
  const name = String(entry.name || "").trim() || `Resource ${index + 1}`;
  const key = `${folderPath}::${name}::${entry.downloadUrl || entry.gcsPath || entry.objectPath || entry.object || index}`;
  const generatedId = toUrlSafeBase64(key).slice(0, 48);

  return {
    id: String(entry.id || generatedId),
    name,
    description: entry.description ? String(entry.description) : "",
    category: entry.category ? String(entry.category) : "",
    folderPath,
    isFolder: false,
    type: inferType(entry),
    size: entry.size ? String(entry.size) : "",
    sizeBytes: getSizeBytes(entry.sizeBytes || entry.bytes || entry.size),
    updatedAt: entry.updatedAt ? String(entry.updatedAt) : "",
    downloadUrl: entry.downloadUrl ? String(entry.downloadUrl) : "",
    gcsPath: entry.gcsPath ? String(entry.gcsPath) : "",
    bucket: entry.bucket ? String(entry.bucket) : "",
    object: entry.object ? String(entry.object) : "",
    objectPath: entry.objectPath ? String(entry.objectPath) : ""
  };
}

function formatSize(sizeValue) {
  const bytes = Number(sizeValue);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace(/\.0$/, "")} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1).replace(/\.0$/, "")} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(1).replace(/\.0$/, "")} GB`;
}

function getSizeBytes(sizeValue) {
  const bytes = Number(sizeValue);
  return Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
}

function getCustomMetadata(metadata) {
  return metadata?.metadata && typeof metadata.metadata === "object" ? metadata.metadata : {};
}

function getCategoryMap() {
  const rawMap = getEnvValue("RESOURCE_CENTER_CATEGORY_MAP");
  if (!rawMap) return {};

  try {
    const parsed = JSON.parse(rawMap);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error("Invalid RESOURCE_CENTER_CATEGORY_MAP: expected JSON object.");
    return {};
  }
}

function getMappedCategory(objectPath) {
  const normalizedObject = normalizePath(objectPath);
  const categoryMap = getCategoryMap();
  return Object.entries(categoryMap)
    .map(([path, category]) => ({
      path: normalizePath(path),
      category: String(category || "").trim()
    }))
    .filter((entry) => entry.path && entry.category)
    .sort((a, b) => b.path.length - a.path.length)
    .find((entry) => normalizedObject === entry.path || normalizedObject.startsWith(`${entry.path}/`))?.category || "";
}

function getResourceCategory(normalizedObject, metadata) {
  const customMetadata = getCustomMetadata(metadata);
  const customCategory =
    customMetadata.category ||
    customMetadata.resourceCategory ||
    customMetadata["resource-category"];
  return String(customCategory || getMappedCategory(normalizedObject) || "").trim();
}

function parseGsPath(raw) {
  const value = String(raw || "").trim();
  if (!value.startsWith("gs://")) return null;
  const stripped = value.slice(5);
  const slash = stripped.indexOf("/");
  if (slash <= 0 || slash === stripped.length - 1) return null;
  return {
    bucket: stripped.slice(0, slash),
    object: normalizePath(stripped.slice(slash + 1))
  };
}

function buildPublicGcsUrl(bucket, objectPath) {
  const object = normalizePath(objectPath);
  if (!bucket || !object) return "";
  const encodedObject = object.split("/").map(encodeURIComponent).join("/");
  return `https://storage.googleapis.com/${encodeURIComponent(bucket)}/${encodedObject}`;
}

function isEnvTrue(name) {
  return getEnvValue(name).toLowerCase() === "true";
}

function sanitizeFilename(name) {
  return String(name || "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[\\/\r\n]/g, "-")
    .replace(/["']/g, "")
    .trim()
    .slice(0, 255) || "resource";
}

function buildAttachmentDisposition(filename) {
  const safeName = sanitizeFilename(filename);
  const fallback = safeName.replace(/[^A-Za-z0-9._-]/g, "_");
  const encoded = encodeURIComponent(safeName);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function getStorageClient() {
  if (storageClient) return storageClient;
  const rawCredentials = getCredentialJson();
  if (rawCredentials) {
    let credentials;
    try {
      credentials = JSON.parse(rawCredentials);
    } catch (error) {
      throw new Error("Invalid RESOURCE_CENTER_GCP_SERVICE_ACCOUNT_JSON: expected valid service account JSON.");
    }
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error(
        "Invalid RESOURCE_CENTER_GCP_SERVICE_ACCOUNT_JSON: missing required fields client_email/private_key."
      );
    }
    storageClient = new Storage({
      projectId: credentials.project_id || getEnv("GOOGLE_CLOUD_PROJECT") || getEnv("GCLOUD_PROJECT"),
      credentials
    });
    return storageClient;
  }
  storageClient = new Storage();
  return storageClient;
}

async function listPublicBucketFiles(bucketName, prefix) {
  const files = [];
  let pageToken = "";

  do {
    const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o`);
    url.searchParams.set("projection", "noAcl");
    url.searchParams.set("fields", "items(name,size,updated,metadata),nextPageToken");
    if (prefix) url.searchParams.set("prefix", prefix);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Public bucket listing failed with ${response.status}`);
    }

    const payload = await response.json();
    (payload.items || []).forEach((item) => {
      files.push({
        name: item.name,
        metadata: {
          size: item.size,
          updated: item.updated,
          metadata: item.metadata || {}
        }
      });
    });
    pageToken = payload.nextPageToken || "";
  } while (pageToken);

  return files;
}

function makeBucketResource(bucketName, objectName, metadata, storageObjectName) {
  const rawObject = String(objectName || "").replace(/\\/g, "/").trim();
  if (!rawObject) return null;
  const normalizedObject = normalizePath(rawObject);
  if (!normalizedObject) return null;
  const rawStorageObject = String(storageObjectName || rawObject).replace(/\\/g, "/").trim();
  const normalizedStorageObject = normalizePath(rawStorageObject);
  const isFolderPlaceholder = rawObject.endsWith("/") || rawStorageObject.endsWith("/");

  const segments = normalizedObject.split("/");
  const leafName = segments.pop();
  const folderPath = normalizePath(segments.join("/"));
  const category = getResourceCategory(normalizedObject, metadata);
  const idSource = isFolderPlaceholder
    ? `gcs://${bucketName}/${normalizedStorageObject}/`
    : `gcs://${bucketName}/${normalizedStorageObject}`;
  const id = toUrlSafeBase64(idSource).slice(0, 48);

  if (isFolderPlaceholder) {
    return {
      id,
      name: leafName || normalizedObject,
      description: "",
      category,
      folderPath,
      isFolder: true,
      type: "",
      size: "",
      updatedAt: metadata?.updated ? String(metadata.updated).slice(0, 10) : "",
      downloadUrl: "",
      gcsPath: "",
      bucket: bucketName,
      object: "",
      objectPath: ""
    };
  }

  return {
    id,
    name: leafName || normalizedObject,
    description: "",
    category,
    folderPath,
    isFolder: false,
    type: inferType({ objectPath: normalizedObject }),
    size: formatSize(metadata?.size),
    sizeBytes: getSizeBytes(metadata?.size),
    updatedAt: metadata?.updated ? String(metadata.updated).slice(0, 10) : "",
    downloadUrl: "",
    gcsPath: `gs://${bucketName}/${normalizedStorageObject}`,
    bucket: bucketName,
    object: normalizedStorageObject,
    objectPath: normalizedStorageObject
  };
}

async function getResources() {
  const { bucket: bucketName, prefix } = getConfiguredBucket();
  if (!bucketName) {
    return DEMO_RESOURCES.map(toResourceEntry);
  }

  let files;
  const listPrefix = prefix ? `${prefix}/` : "";
  try {
    const storage = getStorageClient();
    [files] = await storage.bucket(bucketName).getFiles(listPrefix ? { prefix: listPrefix } : undefined);
  } catch (error) {
    if (!hasCredentialJson() || isEnvTrue("RESOURCE_CENTER_ALLOW_PUBLIC_GCS_FALLBACK")) {
      try {
        files = await listPublicBucketFiles(bucketName, listPrefix);
      } catch (publicError) {
        throw new Error(
          "Failed to list resources from configured bucket. Check RESOURCE_CENTER_GCS_BUCKET (or RESOURCE_CENTER_BUCKET/GCS_BUCKET/GOOGLE_CLOUD_STORAGE_BUCKET), GCP credentials, or public bucket read access."
        );
      }
    } else {
      throw new Error(
        "Failed to list resources from configured bucket. Check RESOURCE_CENTER_GCS_BUCKET (or RESOURCE_CENTER_BUCKET/GCS_BUCKET/GOOGLE_CLOUD_STORAGE_BUCKET) and GCP credentials."
      );
    }
  }
  return files
    .map((file) =>
      makeBucketResource(bucketName, stripConfiguredPrefix(file.name, prefix), file.metadata || {}, file.name)
    )
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getBreadcrumbs(path) {
  const normalized = normalizePath(path);
  const segments = normalized ? normalized.split("/") : [];
  const crumbs = [{ label: "Drive", path: "" }];
  let cumulative = "";
  segments.forEach((segment) => {
    cumulative = cumulative ? `${cumulative}/${segment}` : segment;
    crumbs.push({ label: segment, path: cumulative });
  });
  return crumbs;
}

function folderChildren(resources, currentPath) {
  const base = normalizePath(currentPath);
  const prefix = base ? `${base}/` : "";
  const names = new Set();

  resources.forEach((resource) => {
    const folderPath = normalizePath(resource.folderPath);
    const candidatePath = resource.isFolder
      ? normalizePath(`${folderPath}/${String(resource.name || "").trim()}`)
      : folderPath;
    if (base && !candidatePath.startsWith(prefix)) return;
    if (!base && !candidatePath) return;
    const remaining = base ? candidatePath.slice(prefix.length) : candidatePath;
    if (!remaining) return;
    const next = remaining.split("/")[0];
    if (next) names.add(next);
  });

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      path: base ? `${base}/${name}` : name
    }));
}

function filesInFolder(resources, currentPath) {
  const base = normalizePath(currentPath);
  return resources
    .filter((resource) => !resource.isFolder && normalizePath(resource.folderPath) === base)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function resolveResourceUrl(resource, action = "download") {
  if (resource.downloadUrl && /^https?:\/\//i.test(resource.downloadUrl)) {
    return resource.downloadUrl;
  }

  const parsedGsPath = parseGsPath(resource.gcsPath);
  const fallbackBucket = getConfiguredBucketName();
  const bucket = resource.bucket || parsedGsPath?.bucket || fallbackBucket;
  const objectPath = normalizePath(resource.objectPath || resource.object || parsedGsPath?.object || "");
  if (!bucket || !objectPath) return "";

  const hasServiceAccountCredentials = hasCredentialJson();
  if (!hasServiceAccountCredentials && bucket && objectPath) {
    return buildPublicGcsUrl(bucket, objectPath);
  }

  try {
    const storage = getStorageClient();
    const file = storage.bucket(bucket).file(objectPath);
    const ttlSeconds = Number(getEnv("RESOURCE_CENTER_SIGNED_URL_TTL_SECONDS") || DEFAULT_SIGNED_URL_TTL_SECONDS);
    const expires =
      Date.now() + (Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_SIGNED_URL_TTL_SECONDS) * 1000;
    const filename = sanitizeFilename(resource.name || objectPath.split("/").pop() || "resource");
    const options = {
      version: "v4",
      action: "read",
      expires
    };

    if (action === "download") {
      options.responseDisposition = buildAttachmentDisposition(filename);
    } else if (action === "preview") {
      options.responseDisposition = "inline";
    }

    const [signedUrl] = await file.getSignedUrl(options);
    return signedUrl;
  } catch (error) {
    if (isEnvTrue("RESOURCE_CENTER_ALLOW_PUBLIC_GCS_FALLBACK")) {
      return buildPublicGcsUrl(bucket, objectPath);
    }
    throw error;
  }
}

module.exports = {
  normalizePath,
  getResources,
  getBreadcrumbs,
  folderChildren,
  filesInFolder,
  resolveResourceUrl,
  buildAttachmentDisposition,
  sanitizeFilename
};
