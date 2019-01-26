const jwt = require("jsonwebtoken");

function getAPIKeyFromHeader (request) {
    if (!request.get("authorization")
        || ! request.get("authorization").includes("Bearer ")
        || request.get("authorization").split(" ").length < 2) {
        throw {
                error: "api_unauthorized",
                message: "Expecting Authorization header to be set as 'Bearer {API Key}'.",
            }; 
    }
    const apiKey = request.get("authorization").split(" ")[1];
    return apiKey;
}

function validate(request, requiredScopes) {
    const apiKey = getAPIKeyFromHeader(request);
    const secretKey = process.env.SECRET_KEY || "";
    let payload = null;
    try {
        payload = jwt.verify(apiKey, secretKey);
    } catch (e) {
        throw {
            error: "api_forbidden",
            message: `Malformed API key: ${e}`,
        }; 
    }
    if (!payload.uid) {
        throw {
            error: "api_forbidden",
            message: "Malformed API key. Missing or empty 'uid'.",
        };
    }
    if (!payload.realm) {
        throw {
            error: "api_forbidden",
            message: "Malformed API key. Missing or empty 'realm'.",
        };
    }
    const hasSufficientScopes = requiredScopes.every(
        (requiredScope) => (payload.scopes.includes(requiredScope))
    );

    if (!hasSufficientScopes) {
        throw {
            error: "api_forbidden",
            message: "Insufficient scopes on the API key.",
        };
    }
    return {
        id: payload.realm
    };
    // todo: check validy period.
}

module.exports = {
    validate
};
