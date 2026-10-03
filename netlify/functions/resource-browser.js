const {
  normalizePath,
  getResources,
  getBreadcrumbs,
  folderChildren,
  filesInFolder
} = require("./_resource-center");

function parseQuery(event) {
  const rawPath = event.queryStringParameters?.path || "";
  const search = String(event.queryStringParameters?.search || "").trim().toLowerCase();
  const category = String(event.queryStringParameters?.category || "").trim();
  const type = String(event.queryStringParameters?.type || "").trim().toLowerCase();
  return {
    path: normalizePath(rawPath),
    search,
    category,
    type
  };
}

function filterFiles(files, query) {
  return files.filter((file) => {
    const matchesSearch =
      !query.search ||
      [file.name, file.description, file.category, file.type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query.search);
    const matchesCategory = !query.category || file.category === query.category;
    const matchesType = !query.type || file.type === query.type;
    return matchesSearch && matchesCategory && matchesType;
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  const query = parseQuery(event);
  let resources;
  try {
    resources = await getResources();
  } catch (error) {
    console.error("resource-browser failed to load resources:", error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to load resources" })
    };
  }
  const allCategories = [...new Set(resources.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const allTypes = [...new Set(resources.map((item) => item.type).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const folders = folderChildren(resources, query.path);
  const files = filterFiles(filesInFolder(resources, query.path), query).map((file) => ({
    id: file.id,
    name: file.name,
    description: file.description,
    category: file.category,
    type: file.type,
    size: file.size,
    sizeBytes: file.sizeBytes || 0,
    updatedAt: file.updatedAt,
    folderPath: file.folderPath
  }));

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({
      currentPath: query.path,
      breadcrumbs: getBreadcrumbs(query.path),
      folders,
      files,
      filters: {
        categories: allCategories,
        types: allTypes
      }
    })
  };
};
