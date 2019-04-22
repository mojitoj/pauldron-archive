const PauldronClient = require("pauldron-clients");

const {
    UMA_MODE,
    UMA_SERVER_BASE,
    UMA_SERVER_REALM,
    UMA_SERVER_AUTHORIZATION_ENDPOINT,
    UMA_SERVER_PERMISSION_REGISTRATION_ENDPOINT,
    UMA_SERVER_PROTECTION_API_KEY
} = require("./UMAConfigs");

function umaHeader(ticket) {
    return `UMA realm=\"${UMA_SERVER_REALM}\", as_uri=\"${UMA_SERVER_BASE}\", ticket=\"${ticket}\"`;
}

function handleCommonExceptions(e, res) {
    if (e.error === "unauthorized" || e.error === "forbidden") {
        res.statusCode = e.status;
        const responseBody = {
            message: e.message,
            error: "authorization_error",
            status: e.status
        };
        res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
        return true;
    } else if (e.error === "uma_redirect" ||
        e.error === "invalid_rpt" ||
        e.error === "insufficient_scopes") {
        res.statusCode = e.status;
        res.set({
            "WWW-Authenticate": umaHeader(e.ticket)
        });
        const responseBody = {
            message: `Need approval from ${UMA_SERVER_BASE}.`,
            error: e.error,
            status: e.status,
            ticket: e.ticket,
            info: {
                "server": {
                    realm: UMA_SERVER_REALM,
                    uri: UMA_SERVER_BASE,
                    authorization_endpoint: UMA_SERVER_AUTHORIZATION_ENDPOINT
                }
            }
        };
        res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
        return true;
    } else if (
        e.error === "permission_registration_error" ||
        e.error === "introspection_error") {
        res.statusCode = 403;
        res.set({
            "Warning": "199 - \"UMA Authorization Server Unreachable\""
        });
        const responseBody = {
            message: `Could not arrange authorization: ${e.message}.`,
            error: "authorization_error",
            status: 403
        };
        logger.debug(e.message);
        res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
        return true;
    } else if (e.error === "patient_not_found") {
        res.statusCode = 403;
        const responseBody = {
            message: `Could not arrange authorization: ${e.message}.`,
            error: "authorization_error",
            status: 403,
        };
        res.write(Buffer.from(JSON.stringify(responseBody), "utf8"));
        return true;
    } else {
        return false;
    }
}


async function noRptException(requiredPermissions) {
    return (UMA_MODE) 
    ?{
        ...await registerPermissionsAndGetTicket(requiredPermissions),
        error: "uma_redirect",
        status: 401
    }
    :{
        error: "unauthorized",
        message: "Must provide a valid bearer token.",
        status: 401
    };
}

async function invalidRptException(requiredPermissions) {
    return (UMA_MODE) 
    ?{
        ...await registerPermissionsAndGetTicket(requiredPermissions),
        error: "invalid_rpt",
        status: 403
    }
    :{
        error: "forbidden",
        message: "Invalid bearer token.",
        status: 403
    };
}

async function insufficientScopesException(requiredPermissions) {
    return (UMA_MODE) 
    ?{
        ...await registerPermissionsAndGetTicket(requiredPermissions),
        error: "insufficient_scopes",
        status: 403
    }
    :{
        error: "forbidden",
        message: "Insufficient scopes.",
        status: 403
    };
}

async function registerPermissionsAndGetTicket(permissions) {
    return {
        ticket: await PauldronClient.Permissions.register(
            permissions,
            `${UMA_SERVER_BASE}${UMA_SERVER_PERMISSION_REGISTRATION_ENDPOINT}`,
            UMA_SERVER_PROTECTION_API_KEY)
    };
}

module.exports = {
    noRptException,
    invalidRptException,
    insufficientScopesException,
    handleCommonExceptions
};
