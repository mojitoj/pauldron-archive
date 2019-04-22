const zlib = require("zlib");
const _ = require("lodash");
const PermissionDiscovery = require("../lib/PermissionDiscovery");
const logger = require("../lib/logger");
const PermissionEvaluation = require("../lib/PermissionEvaluation");
const RequestUtils = require("../lib/RequestUtils");
const ErrorUtils = require("../lib/ErrorUtils");
const BulkHandler = require("../controllers/BulkHandler");

const UNPROTECTED_RESOURCE_TYPES = (process.env.UNPROTECTED_RESOURCE_TYPES || "")
                                        .split(",")
                                        .map(res => res.trim());

async function onProxyReq(proxyReq, req, res) {
    await BulkHandler.maybeHandleBulkExport(proxyReq, req, res);
}

async function onProxyRes(proxyRes, req, res) {
    let rawBackendBody = Buffer.from([]);
    proxyRes.on("data", data => {
        rawBackendBody = Buffer.concat([rawBackendBody, data]);
    });

    proxyRes.on("end", async () => {
        const method = req.method;
        if (method === "GET") {
            handleGet(rawBackendBody, proxyRes, req, res);
        } else {
            sendIntactResponse (rawBackendBody, proxyRes, req, res);
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
    let backendResponseBytes = rawBackendBody;
    let backendResponse = null;
    try {
        const backendResponseStatus = proxyRes.statusCode;
        if (backendResponseStatus ===200) {
            if (rawBackendBody.length) {
                const encoding = proxyRes.headers['content-encoding'];
                if (encoding === "gzip") {
                    backendResponseBytes = zlib.gunzipSync(rawBackendBody);
                } else if (encoding === "deflate") {
                    backendResponseBytes = zlib.inflateSync(rawBackendBody);
                } 
                backendResponse = JSON.parse(backendResponseBytes.toString("utf8"));
            }
            if (backendResponse && backendResponseIsProtected(backendResponse)) {
                await processProtecetedResource(req, backendResponse);
            }
        }
        res.set(proxyRes.headers);
        res.statusCode = proxyRes.statusCode;
        res.write(rawBackendBody);
    } catch (e) {
        if (! ErrorUtils.handleCommonExceptions(e, res)) {
            if (e instanceof SyntaxError) {
                res.statusCode = 400;
                const responseBody = {
                    message: "Invalid response from the FHIR server. Pauldron Hearth only supports JSON at this time.",
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

const httpMethodToAction = {
    "GET": "read",
    "DELETE": "delete"
};

async function processProtecetedResource(request, backendResponse) {
    const action = httpMethodToAction[request.method]; //todo: this logic must be improved; e.g. a post request could be a search therefore a read. 
    const requiredPermissions = await PermissionDiscovery.getRequiredPermissions(backendResponse, action);
    let grantedPermissions = [];
    try {
        grantedPermissions = await RequestUtils.getGrantedPermissions(request);
        ensureSufficientPermissions(requiredPermissions, grantedPermissions);
    } catch (e) {
        if (e.error === "no_rpt") {
            throw await ErrorUtils.noRptException(requiredPermissions);
        } else if (e.error === "insufficient_scopes") {
            throw await ErrorUtils.insufficientScopesException(requiredPermissions);
        } else if (e.error === "invalid_rpt") {
            throw await ErrorUtils.invalidRptException(requiredPermissions);
        } else {
            throw e;
        }
    }
}

function backendResponseIsProtected(backendResponse) {
    const resourceType = backendResponse.resourceType;

    if (resourceType === "Bundle" && backendResponse.entry.length > 0) {
        const entries = backendResponse.entry;
        return !entries.every((entry) => (UNPROTECTED_RESOURCE_TYPES.includes(entry.resource.resourceType)));
    } else if (resourceType) {
        return !UNPROTECTED_RESOURCE_TYPES.includes(resourceType);
    } else {
        return false;
    }
}

function ensureSufficientPermissions(required, granted) {
    const sufficientPermissions = PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(granted, required);

    if (!sufficientPermissions) {
        throw {
            error: "insufficient_scopes"
        };
    }
}

module.exports = {
    onProxyRes,
    onProxyReq
}
