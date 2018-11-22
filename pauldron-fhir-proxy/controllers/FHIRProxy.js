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

async function get(req, res, next) {
    const url = req.originalUrl;

    const options = {
        method: "GET",
        json: true,
        uri: FHIR_SERVER_BASE + url,
        simple: false,
        resolveWithFullResponse: true
    };

    try {
        const backendRawResponse = await rp(options);
        const backendResponse = backendRawResponse.body;

        if (backendResponse && backendResponseIsProtected(backendResponse)) {
            await processProtecetedResource(req, backendResponse);
        }
        res.status(backendRawResponse.statusCode).send(backendResponse);
    } catch (e) {
        if (e.error === "uma_redirect" ||
            e.error === "invalid_rpt") {
            res.status(e.status)
            .set("WWW-Authenticate", `UMA realm=\"${e.umaServerParams.realm}\", as_uri=\"${e.umaServerParams.uri}\", ticket=\"${e.ticket}\"`)
            .send({
                    message: `Need approval from ${e.umaServerParams.uri}.`,
                    error: e.error,
                    status: e.status,
                    ticket: e.ticket,
                    info: {"server": e.umaServerParams}
                }
            );
        } else if (
            e.error === "permission_registration_error" ||
            e.error === "introspection_error"
        ) {
            res.status(403)
            .set("Warning", "199 - \"UMA Authorization Server Unreachable\"")
            .send({
                    message: `Could not arrange authorization: ${e.message}.`,
                    error: "authorization_error",
                    status: 403,
            });
        } else if (e.error === "patient_not_found") {
            res.status(403)
            .send({
                    message: `Could not arrange authorization: ${e.message}.`,
                    error: "authorization_error",
                    status: 403,
            });
        } else {
            logger.warn(e);
            res.status(500).send({
                message: `FHIRProxy encountered an error`,
                error: "internal_error",
                status: 500
            });
        }
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
    get 
}
