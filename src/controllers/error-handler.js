const logger = require ("../lib/logger");

function handle(e, response, request) {
    if (e.status) {
        response.status(e.status).send(e);
    } else if (e.error === "api_unauthorized") {
        response.status(401).send(
            {
                message: `API Unauthorized: ${e.message}.`,
                error: "api_unauthorized",
                status: 401
            }
        );
    } else if (e.error === "api_forbidden") {
        response.status(403).send(
            {
                message: `API Forbidden: ${e.message}.`,
                error: "api_forbidden",
                status: 403
            }
        );
    } else if (e.error === "policy_forbidden") {
        response.status(403).send(
            {
                message: "Denied per authorization policies.",
                error: "policy_forbidden",
                status: 403
            }
        );
    } else if (e.error === "bad_request") {
        response.status(400).send(
            {
                message: e.message,
                error: "bad_request",
                status: 400
            }
        );
    } else if (e.error === "object_not_found") {
        response.status(404).send(
            {
                message: `Object not found: ${e.message}.`,
                error: "object_not_found",
                status: 404
            }
        );
    } else if (e.error === "uma_redirect_error") {
        response.status(403)
            .set("Warning", "199 - \"UMA Authorization Server Unreachable\"")
            .send({
                error: "need_info",
                message: e.message,
                status: 403
              }
            );
    } else if (e.error === "uma_introspection_error") {
        response.status(403)
            .set("Warning", "199 - \"UMA Authorization Server Unreachable\"")
            .send({
                message: `Failed at introspecting an RPT: ${e.message}`,
                error: "not_authorized",
                status: 403
            }
        );
    } else if (e.error === "claims_error") {
        response.status(403).send(
            {
                error: "need_info",
                message: e.message || "Error in claims.",
                status: 403
            }
        );
    } 
    else if (e.error === "invalid_ticket") {
        response.status(403).send(
            {
                error: e.error,
                message: e.message || "Invalid ticket.",
                status: 403
            }
        );
    } 
    else if (e.error === "expired_ticket") {
        response.status(403).send(
            {
                error: e.error,
                message: e.message || "Expired ticket.",
                status: 403
            }
        );
    }else {
        response.status(500).send(
            {
                message: "Internal server error.",
                error: "internal_error",
                status: 500
            }
        );
        logger.warn(e);
    }
}

module.exports = {
    handle
};
