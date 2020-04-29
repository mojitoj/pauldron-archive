const zlib = require("zlib");
const _ = require("lodash");

const UNPROTECTED_RESOURCE_TYPES = (
  process.env.UNPROTECTED_RESOURCE_TYPES || ""
)
  .split(",")
  .map((res) => res.trim());

function sendResponse(resObject, headers, statusCode, body) {
  resObject.set(headers);
  resObject.statusCode = statusCode;
  resObject.write(body);
}

function sendJsonResponse(resObject, headers, statusCode, jsonBody) {
  const bodyBytes = Buffer.from(JSON.stringify(jsonBody), "utf8");

  _.unset(headers, "Content-Type");
  _.unset(headers, "content-type");
  _.unset(headers, "Content-Encoding");
  _.unset(headers, "content-encoding");
  _.unset(headers, "transfer-encoding");
  _.unset(headers, "Transfer-Encoding");
  _.unset(headers, "Content-Length");
  _.unset(headers, "content-length");
  const newHeaders = {
    "Content-Type": "application/json",
    "Content-Encoding": "identity",
    "Transfer-Encoding": "identity",
    ...headers
  };
  sendResponse(resObject, newHeaders, statusCode, bodyBytes);
}

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
  parseResponseBody,
  sendResponse,
  sendJsonResponse
};
