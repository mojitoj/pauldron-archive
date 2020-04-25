const _ = require("lodash");

const logger = require("../lib/logger");
const RequestUtils = require("../lib/RequestUtils");
const ErrorUtils = require("../lib/ErrorUtils");
const PermissionEvaluation = require("../lib/PermissionEvaluation");


async function maybeHandleBulkExport(req, res) {
    if (!isBulkExport(req))
        return true;

    try {
        const grantedPermissions = await checkBulkPermissions(req);
        req.adjustedPath = adjustRequestPath(req.url, grantedPermissions);
        return true;
    } catch (e) {
        const errorResponse = ErrorUtils.commonExceptions(e);
        if (errorResponse) {
            res.status(errorResponse.status)
                .set(errorResponse.headers)
                .json(errorResponse.body);
        } else { 
            logger.warn(e);
            res.status(500).json({
                message: "Pauldron Hearth encountered an error",
                error: "internal_error",
                status: 500
            });
        }
    }
}

function adjustRequestPath(path, grantedPermissions) {
    const additionalFilters = permissionsToFilters(grantedPermissions).join(",");
    const url = new URL("http://host" + path);
    const filter = url.searchParams.get("_typeFilter");
    url.searchParams.set('_typeFilter', (filter)? `${filter},${additionalFilters}` : additionalFilters);
    return (url.pathname).substring(1) + url.search;
}

function permissionsToFilters(grantedPermissions) {
    return _.flatten(
            grantedPermissions.map(
                (permission) => permissionToFilters(permission)
            )
    );

}
function permissionToFilters(grantedPermission) {
    return (grantedPermission.deny)
        ? negativePermissionToFilters(grantedPermission)
        : positivePermissionToFilters(grantedPermission)
}

function positivePermissionToFilters(grantedPermission) {
    let labels = grantedPermission.resource_set_id.securityLabel;
    
    if (labels === "*") {
        return [];
    }

    const labelFilterString = labels.map((label)=>label.code).join(",");
    
    let resourceTypes = grantedPermission.resource_set_id.resourceType;
    resourceTypes = (resourceTypes==="*")? ["*"] : resourceTypes;
    return resourceTypes.map( 
        (resourceType) => (`${resourceType}?_security=${labelFilterString}`)
    );
}

function negativePermissionToFilters(grantedPermission) {
    const labels = grantedPermission.resource_set_id.securityLabel;
    //labels = (labels==="*")? [] : labels;
    //labels cannot be wildcard because the request would have been rejected 
    // on the basis of resource type if that resource type is requested.

    let resourceTypes = grantedPermission.resource_set_id.resourceType;
    resourceTypes = (resourceTypes==="*")? ["*"] : resourceTypes;

    return _.flatten(
        resourceTypes.map(
            (resourceType) => labels.map(
                (label) => `${resourceType}?_security:not=${label.code}`
            )
        )
    );
}

async function checkBulkPermissions(request) {
    const requiredPermissions = requiredBulkPermissions(request);

    try {
        const grantedPermissions = await RequestUtils.getGrantedPermissions(request);
        checkSufficientScopes(grantedPermissions, requiredPermissions);
        return grantedPermissions;
    } catch (e) {
        const permissionsToRegister = adjustRequiredPermissionsForRegistration(requiredPermissions);
        if (e.error === "no_rpt") {
            throw await ErrorUtils.noRptException(permissionsToRegister);
        } else if (e.error === "insufficient_scopes") {
            throw await ErrorUtils.insufficientScopesException(permissionsToRegister);
        } else if (e.error === "invalid_rpt") {
            throw await ErrorUtils.invalidRptException(permissionsToRegister);
        } else {
            throw e;
        }
    }
}

function adjustRequiredPermissionsForRegistration(requiredPermissions) {
    return requiredPermissions.map((permission) => 
        (
            {
                ... permission,
                securityLabel: "*"
            }
        )
    );
}

function checkSufficientScopes(grantedPermissions, requiredPermissions) {
    //disregard labels because we will adjust it with redaction and filtering.
    const grantedBulkPermissionsRegardlessOfLabels = permissionsRegardlessOfLabels(grantedPermissions);
    if (!PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(grantedBulkPermissionsRegardlessOfLabels, requiredPermissions)) {
        throw {
            error: "insufficient_scopes"
        };
    }
}

function permissionsRegardlessOfLabels(grantedPermissions) {
    const withoutSecurityLabels = grantedPermissions
        .filter(
            (permission) => (permission.scopes.includes("bulk-export"))
        ).map( 
            (permission) => (
                { 
                    ... _.omit(permission, "resource_set_id.securityLabel"), 
                    scopes: ["bulk-export"]
                }
            )
        );
    const granted = withoutSecurityLabels.filter(
        (permission) => !permission.deny
    );
    const modifiedDenied = withoutSecurityLabels.filter(
        (permission) => 
            permission.deny && 
            !granted.some((aGranted) => _.isEqual(_.omit(permission, "deny"), aGranted))
    );
    return _.concat(granted, modifiedDenied);
}

function requiredBulkPermissions(request) {
    allResourceTypes = _.get(request.query, "_type") || "*";
    
    return allResourceTypes.split(",").map(res => res.trim())
        .map( (resourceType) => (
            {
                resource_set_id: {
                    patientId: "*",
                    resourceType: resourceType
                },
                scopes: [
                    "bulk-export"
                ]
            }
    ));
}

function isBulkExport(request) {
    return (
        request.method==="GET" && 
        (request.path.includes("$export") || request.path.includes("%24export"))
        );
}

module.exports = {
    maybeHandleBulkExport,
    adjustRequestPath
}
