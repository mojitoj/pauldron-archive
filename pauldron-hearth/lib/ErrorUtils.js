const PauldronClient = require("pauldron-clients");
const logger = require("../lib/logger");

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

function commonExceptions(e) {
  const res = {};
  if (e.error === "unauthorized" || e.error === "forbidden") {
    return {
      status: e.status,
      body: {
        message: e.message,
        error: "authorization_error",
        status: e.status
      }
    };
  } else if (
    e.error === "uma_redirect" ||
    e.error === "invalid_rpt" ||
    e.error === "insufficient_scopes"
  ) {
    return {
      status: e.status,
      headers: {
        "WWW-Authenticate": umaHeader(e.ticket)
      },
      body: {
        message: `Need approval from ${UMA_SERVER_BASE}.`,
        error: e.error,
        status: e.status,
        ticket: e.ticket,
        info: {
          server: {
            realm: UMA_SERVER_REALM,
            uri: UMA_SERVER_BASE,
            authorization_endpoint: UMA_SERVER_AUTHORIZATION_ENDPOINT
          }
        }
      }
    };
  } else if (
    e.error === "permission_registration_error" ||
    e.error === "introspection_error"
  ) {
    logger.debug(e.message);
    return {
      status: 403,
      headers: {
        Warning: '199 - "UMA Authorization Server Unreachable"'
      },
      body: {
        message: `Could not arrange authorization: ${e.message}.`,
        error: "authorization_error",
        status: 403
      }
    };
  } else if (e.error === "patient_not_found") {
    return {
        status: 403,
        body: {
            message: `Could not arrange authorization: ${e.message}.`,
            error: "authorization_error",
            status: 403
        }
      };
  }
  //don't return anything if you didn't handle it.
}

function handleCommonExceptionsForProxyResponse(e, res) {
  const errorResponse = commonExceptions(e);
  if (errorResponse) {
    res.statusCode = errorResponse.status;

    res.set({
      ...errorResponse.headers,
      "Content-Type": "application/json"
    });
    res.write(Buffer.from(JSON.stringify(errorResponse.body), "utf8"));
    return true;
  } else {
    return false;
  }
}

async function noRptException(requiredPermissions) {
  return UMA_MODE()
    ? {
        ...(await registerPermissionsAndGetTicket(requiredPermissions)),
        error: "uma_redirect",
        status: 401
      }
    : {
        error: "unauthorized",
        message: "Must provide a valid bearer token.",
        status: 401
      };
}

async function invalidRptException(requiredPermissions) {
  return UMA_MODE()
    ? {
        ...(await registerPermissionsAndGetTicket(requiredPermissions)),
        error: "invalid_rpt",
        status: 403
      }
    : {
        error: "forbidden",
        message: "Invalid bearer token.",
        status: 403
      };
}

async function insufficientScopesException(requiredPermissions) {
  return UMA_MODE()
    ? {
        ...(await registerPermissionsAndGetTicket(requiredPermissions)),
        error: "insufficient_scopes",
        status: 403
      }
    : {
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
      UMA_SERVER_PROTECTION_API_KEY
    )
  };
}

module.exports = {
  noRptException,
  invalidRptException,
  insufficientScopesException,
  commonExceptions,
  handleCommonExceptionsForProxyResponse
};
