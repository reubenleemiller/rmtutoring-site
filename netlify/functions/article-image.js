const { readImageUpload } = require("./_article-store");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: "Method Not Allowed" })
    };
  }

  const id = event.queryStringParameters?.id || "";
  const image = await readImageUpload(id);

  if (!image) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: "Image not found." })
    };
  }

  return {
    statusCode: 200,
    isBase64Encoded: true,
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable"
    },
    body: image.base64
  };
};
