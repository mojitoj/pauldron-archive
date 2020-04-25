const zlib = require("zlib");

const UNPROTECTED_RESOURCE_TYPES = (
  process.env.UNPROTECTED_RESOURCE_TYPES || ""
)
  .split(",")
  .map((res) => res.trim());

function responseIsProtected(response) {
  return (
    response &&
    (responseIsProtectedBundle(response) ||
      responseIsProtectedResource(response))
  );
}

function responseIsProtectedBundle(response) {
  return (
    response.resourceType === "Bundle" &&
    response.entry &&
    response.entry.length > 0 &&
    !response.entry.every((anEntry) =>
      UNPROTECTED_RESOURCE_TYPES.includes(anEntry.resource.resourceType)
    )
  );
}

function responseIsProtectedResource(response) {
  return (
    response.resourceType !== "Bundle" &&
    !UNPROTECTED_RESOURCE_TYPES.includes(response.resourceType)
  );
}

function parseResponseBody(rawBody, contentEncoding) {
  if (!rawBody.length) {
    return null;
  }
  const backendResponseBytes =
    contentEncoding === "gzip"
      ? zlib.gunzipSync(rawBody)
      : contentEncoding === "deflate"
      ? zlib.inflateSync(rawBody)
      : rawBody;
  return JSON.parse(backendResponseBytes.toString("utf8"));
}

module.exports = {
  responseIsProtected,
  parseResponseBody
};
