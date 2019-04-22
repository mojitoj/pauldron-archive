const _ = require("lodash");
const RequestUtils = require("../lib/RequestUtils");
const ErrorUtils = require("../lib/ErrorUtils");
const PermissionEvaluation = require("../lib/PermissionEvaluation");

async function maybeHandleBulkExport(proxyReq, request, response) {
    if (!isBulkExport(request))
        return;
    
    try {
        const grantedPermissions = await checkBulkPermissions(request);
        proxyReq.path = adjustRequestPath(request.path, grantedPermissions);
        logger.info(`proxy -> backend: ${proxyReq.path}`);
    } catch (e) {
        if (! ErrorUtils.handleCommonExceptions(e, response)) {            
            logger.warn(e);
            res.statusCode = 500;
            const responseBody = {
                message: "Pauldron Hearth encountered an error",
                error: "internal_error",
                status: 500
            };
            res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
        }
        res.end();
    }
}

function adjustRequestPath(path, grantedPermissions) {
    return path;
}

async function checkBulkPermissions(request) {
    try {
        const requiredPermissions = requiredBulkPermissions(request);
        const grantedPermissions = await RequestUtils.getGrantedPermissions(request);
        checkSufficientScopes(grantedPermissions, requiredPermissions);
        return grantedPermissions;
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

function checkSufficientScopes(grantedPermissions, requiredPermissions) {
    if (!PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(grantedPermissions, requiredPermissions)) {
        throw {
            error: "insufficient_scopes"
        };
    }
}

function requiredBulkPermissions(request) {
    path = new URL(request.path);
    
    allResourceTypes = path.searchParams.get("_type") || "*";
    
    return allResourceTypes.split(",").map(res => res.trim())
        .map( (resourceType) => (
            {
                resource_set_id: {
                patientId: "*",
                resourceType: resourceType,
                securityLabel: []
                },
                scopes: [
                "bulk-export"
                ]
            }
    ));
}

function isBulkExport(request) {
    return (request.method==="GET" && request.path.includes("$export"));
}

module.exports = {
    maybeHandleBulkExport
}
