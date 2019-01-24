const zlib = require("zlib");
const rp = require("request-promise");
const PauldronClient = require("pauldron-clients");
const _ = require("lodash");
const PermissionDiscovery = require("../lib/PermissionDiscovery");
const logger = require("../lib/logger");

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE;
const UNPROTECTED_RESOURCE_TYPES = (process.env.UNPROTECTED_RESOURCE_TYPES || "")
                                        .split(",")
                                        .map(res => res.trim());

const UMA_SERVER_BASE = process.env.UMA_SERVER_BASE;
const UMA_SERVER_REALM = process.env.UMA_SERVER_REALM;
const UMA_SERVER_AUTHORIZATION_ENDPOINT = process.env.UMA_SERVER_AUTHORIZATION_ENDPOINT;

const UMA_SERVER_INTROSPECTION_ENDPOINT = process.env.UMA_SERVER_INTROSPECTION_ENDPOINT;
const UMA_SERVER_PERMISSION_REGISTRATION_ENDPOINT = process.env.UMA_SERVER_PERMISSION_REGISTRATION_ENDPOINT;
const UMA_SERVER_PROTECTION_API_KEY = process.env.UMA_SERVER_PROTECTION_API_KEY;

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
        res.set(proxyRes.headers);
        res.statusCode = proxyRes.statusCode;
        res.write(rawBackendBody);
    } catch (e) {
        if (e.error === "uma_redirect" ||
            e.error === "invalid_rpt") {
            res.statusCode = e.status;
            res.set({
                "WWW-Authenticate": `UMA realm=\"${e.umaServerParams.realm}\", as_uri=\"${e.umaServerParams.uri}\", ticket=\"${e.ticket}\"`
            });
            const responseBody = {
                message: `Need approval from ${e.umaServerParams.uri}.`,
                error: e.error,
                status: e.status,
                ticket: e.ticket,
                info: {"server": e.umaServerParams}
            };
            res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
        } else if (
            e.error === "permission_registration_error" ||
            e.error === "introspection_error"
        ) {
            res.statusCode = 403;
            res.set({
                "Warning": "199 - \"UMA Authorization Server Unreachable\""
            });
            const responseBody = {
                message: `Could not arrange authorization: ${e.message}.`,
                error: "authorization_error",
                status: 403
            };
            res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
        } else if (e.error === "patient_not_found") {
            res.statusCode = 403;
            const responseBody = {
                message: `Could not arrange authorization: ${e.message}.`,
                error: "authorization_error",
                status: 403,
            };
            res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
        } else if (e instanceof SyntaxError) {
            res.statusCode = 400;
            const responseBody = {
                message: "Invalid response from the FHIR server. FHIRProxy only supports JSON at this time.",
                error: "unsupported_response",
                status: 500
            };
            res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
        } else {
            logger.warn(e);
            res.statusCode = 500;
            const responseBody = {
                message: "FHIRProxy encountered an error",
                error: "internal_error",
                status: 500
            };
            res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
        }
    } finally {
        res.end();
    }
}

async function processProtecetedResource(request, backendResponse) {
    const requiredPermissions = await PermissionDiscovery.getRequiredPermissions(backendResponse);
    let grantedPermissions = [];
    try {
        grantedPermissions = await getGrantedPermissions(request);
        ensureSufficientPermissions(requiredPermissions, grantedPermissions);
    } catch (e) {
        if (e.error === "no_rpt") {
            const redirectE = await registerPermissionsAndRedirect(requiredPermissions);
            redirectE.error = "uma_redirect";
            redirectE.status = 401;
            throw redirectE;
        } else if (e.error === "insufficient_scopes") {
            const redirectE = await registerPermissionsAndRedirect(requiredPermissions);
            redirectE.error = e.error;
            redirectE.status = 403;
            throw redirectE;
        } else if (e.error === "invalid_rpt") {
            const redirectE = await registerPermissionsAndRedirect(requiredPermissions);
            redirectE.error = e.error;
            redirectE.status = 403;
            throw redirectE;
        }
        else {
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

function deepIncludes(container, containee) {
    return container.some(
        (element) => (_.isEqual(element, containee))
    );
}

function ensureSufficientPermissions(required, granted) {
    const sufficientPermissions = required.every(
        (requiredPermission) => (deepIncludes(granted, requiredPermission))
    );

    if (!sufficientPermissions) {
        throw {
            error: "insufficient_scopes"
        };
    }
}

async function getGrantedPermissions (request) {
    const rpt = getRPTFromHeader(request);

    const grantedPermissions = await PauldronClient.RPT.introspect(
        rpt,
        `${UMA_SERVER_BASE}${UMA_SERVER_INTROSPECTION_ENDPOINT}`,
        UMA_SERVER_PROTECTION_API_KEY
    );
    return grantedPermissions;
}

async function registerPermissionsAndRedirect(permissions) {
    const ticket = await PauldronClient.Permissions.register(
        permissions,
        `${UMA_SERVER_BASE}${UMA_SERVER_PERMISSION_REGISTRATION_ENDPOINT}`,
        UMA_SERVER_PROTECTION_API_KEY
    );
    return {
        ticket: ticket,
        umaServerParams: {
            realm: UMA_SERVER_REALM,
            uri: UMA_SERVER_BASE,
            authorization_endpoint: UMA_SERVER_AUTHORIZATION_ENDPOINT
        }
    };
}

function getRPTFromHeader (request) {
    if (!request.get("authorization")
        || ! request.get("authorization").includes("Bearer ")
        || request.get("authorization").split(" ").length < 2) {
        throw {
            error: "no_rpt"
        };
    }
    const rpt = request.get("authorization").split(" ")[1].trim();
    if (!rpt) {
        throw {
            error: "no_rpt"
        };
    }
    return rpt;
}

module.exports = {
    onProxyRes
}
