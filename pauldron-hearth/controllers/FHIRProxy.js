const _ = require("lodash");

const logger = require("../lib/logger");
const UMAUtils = require("../lib/UMAUtils");
const ResponseUtils = require("../lib/ResponseUtils");
const ErrorUtils = require("../lib/ErrorUtils");
const BulkHandler = require("../controllers/BulkHandler");

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE;
let PROXY_PATH_PREFIX = new URL(FHIR_SERVER_BASE).pathname;
PROXY_PATH_PREFIX = PROXY_PATH_PREFIX.endsWith("/")
  ? PROXY_PATH_PREFIX
  : PROXY_PATH_PREFIX + "/";

async function requestPreprocess(req, res, next) {
  if (await BulkHandler.maybeHandleBulkExport(req, res)) {
    next();
  }
}

async function onProxyReq(proxyReq, req, res) {
  const oldPath = proxyReq.path;
  proxyReq.path = req.adjustedPath
    ? PROXY_PATH_PREFIX + req.adjustedPath
    : proxyReq.path;
  logger.info(`proxy -> backend: was: ${oldPath}, is: ${proxyReq.path}`);
}

async function onProxyRes(proxyRes, req, res) {
  let rawBackendBody = Buffer.from([]);
  proxyRes.on("data", (data) => {
    rawBackendBody = Buffer.concat([rawBackendBody, data]);
  });

  proxyRes.on("end", async () => {
    const method = req.method;
    if (method === "GET") {
      handleGet(rawBackendBody, proxyRes, req, res);
    } else {
      sendIntactResponse(rawBackendBody, proxyRes, req, res);
    }
  });
}

function sendIntactResponse(rawBackendBody, proxyRes, req, res) {
  res.set(proxyRes.headers);
  res.statusCode = proxyRes.statusCode;
  res.write(rawBackendBody);
  res.end();
}

async function handleGet(rawBackendBody, proxyRes, req, res) {
  try {
    const backendResponseStatus = proxyRes.statusCode;
    if (backendResponseStatus === 200) {
      const parserBackendResponse = ResponseUtils.parseResponseBody(
        rawBackendBody,
        proxyRes.headers["content-encoding"]
      );
      if (ResponseUtils.responseIsProtected(parserBackendResponse)) {
        await UMAUtils.processProtecetedResource(req, parserBackendResponse);
      }
    }
    res.set(proxyRes.headers);
    res.statusCode = proxyRes.statusCode;
    res.write(rawBackendBody);
  } catch (e) {
    const handled = ErrorUtils.handleCommonExceptionsForProxyResponse(e, res);
    if (!handled) {
      if (e instanceof SyntaxError) {
        res.statusCode = 400;
        const responseBody = {
          message:
            "Invalid response from the FHIR server. Pauldron Hearth only supports JSON at this time.",
          error: "unsupported_response",
          status: 400
        };
        res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
      } else {
        logger.warn(e);
        res.statusCode = 500;
        const responseBody = {
          message: "Pauldron Hearth encountered an error",
          error: "internal_error",
          status: 500
        };
        res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
      }
    }
  } finally {
    res.end();
  }
}

module.exports = {
  onProxyRes,
  onProxyReq,
  requestPreprocess
};
