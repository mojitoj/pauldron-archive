const PauldronClient = require("pauldron-clients");
const {
    UMA_SERVER_BASE,
    UMA_SERVER_INTROSPECTION_ENDPOINT,
    UMA_SERVER_PROTECTION_API_KEY
} = require("../lib/UMAConfigs")

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

module.exports = {
    getGrantedPermissions
}
