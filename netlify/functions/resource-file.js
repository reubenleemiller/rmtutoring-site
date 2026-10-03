const {
  getResources,
  resolveResourceUrl,
  buildAttachmentDisposition,
  sanitizeFilename
} = require("./_resource-center");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  const id = String(event.queryStringParameters?.id || "").trim();
  const action = String(event.queryStringParameters?.action || "download").trim().toLowerCase();

  if (!id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing resource id" })
    };
  }

  let resources;
  try {
    resources = await getResources();
  } catch (error) {
    console.error("resource-file failed to load resources:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to load resources" })
    };
  }
  const resource = resources.find((item) => item.id === id);
  if (!resource) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Resource not found" })
    };
  }

  let targetUrl = "";
  try {
    targetUrl = await resolveResourceUrl(resource, action);
  } catch (error) {
    console.error("resource-file failed to create resource URL:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to create secure resource URL" })
    };
  }

  if (!targetUrl) {
    return {
      statusCode: 422,
      body: JSON.stringify({ error: "Resource has no valid storage target" })
    };
  }

  if (action === "preview") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        id: resource.id,
        name: resource.name,
        type: resource.type,
        previewUrl: targetUrl
      })
    };
  }

  try {
    const upstream = await fetch(targetUrl);
    if (!upstream.ok) {
      throw new Error(`Upstream download failed with ${upstream.status}`);
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = sanitizeFilename(resource.name || "resource");
    const contentType = upstream.headers.get("content-type") || "application/octet-stream";

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": buildAttachmentDisposition(filename),
        "Cache-Control": "no-store"
      },
      body: buffer.toString("base64")
    };
  } catch (error) {
    console.error("resource-file failed to proxy resource download:", error.message);
    return {
      statusCode: 502,
      body: JSON.stringify({ error: "Failed to download resource" })
    };
  }

};
