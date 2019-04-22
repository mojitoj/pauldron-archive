const PauldronClient = require("pauldron-clients");
const {
    UMA_SERVER_BASE,
    UMA_SERVER_REALM,
    UMA_SERVER_INTROSPECTION_ENDPOINT,
    UMA_SERVER_PROTECTION_API_KEY,
    UMA_SERVER_PERMISSION_REGISTRATION_ENDPOINT,
    UMA_SERVER_AUTHORIZATION_ENDPOINT
} = require("../lib/UMAConfigs");

async function getGrantedPermissions (request) {
    const rpt = getRPTFromHeader(request);

    const grantedPermissions = await PauldronClient.RPT.introspect(
        rpt,
        `${UMA_SERVER_BASE}${UMA_SERVER_INTROSPECTION_ENDPOINT}`,
        UMA_SERVER_PROTECTION_API_KEY
    );
    return grantedPermissions;
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


module.exports = {
    getGrantedPermissions,
    registerPermissionsAndRedirect
}
