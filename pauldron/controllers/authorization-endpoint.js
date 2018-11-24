const hash = require("object-hash");
const rp = require("request-promise");
const db = require("../lib/db");
const logger = require ("../lib/logger");

const TimeStampedPermission = require("../model/TimeStampedPermission");
const UpstreamServers = require("../lib/upstream-servers");
const APIAuthorization = require("../lib/api-authorization");
const GenericErrorHandler = require("./error-handler");
const JWTClaimsToken = require("../lib/jwt-claims-token");


const {SimplePolicyDecisionCombinerEngine} = require ("pauldron-policy");
const {policyTypeToEnginesMap} = require("./policy-endpoint");

const UMA_REDIRECT_OBLIGATION_ID = "UMA_REDIRECT";
const DENY_SCOPES_OBLIGATION_ID = "DENY_SCOPES";

// class UMAClaimToken {
//   format;
//   token;
//   info;
// }
const rptTTL = parseInt(process.env.RPT_TTL) || 20;

async function create(req, res, next) {
    try {
        const user = APIAuthorization.validate(req, ["AUTH:C"]);

        validateRPTRequest(req);

        const policies = await db.Policies.list(user);

        const ticket = req.body.ticket;

        const claimsTokens = req.body.claim_tokens;
        const claims = await parseAndValidateClaimTokens(claimsTokens);

        const permission = await db.Permissions.get(user, ticket);
        validatePermissions(permission);

        const permissionsAfterReconciliationWithPolicies = 
          await checkPolicies(claims, permission.permissions, policies);

        const rpt = TimeStampedPermission.issue(
          rptTTL, 
          permissionsAfterReconciliationWithPolicies, 
          permission.user
        );

        await db.RPTs.add(user, rpt.id, rpt);

        await db.Permissions.del(user, ticket);

        res.status(201).send({rpt: rpt.id});
    } catch (e) {
      if (e && e.error === "uma_redirect") {
        res.status(401)
        .set("WWW-Authenticate", `UMA realm=\"${e.umaServerParams.realm}\", as_uri=\"${e.umaServerParams.uri}\", ticket=\"${e.ticket}\"`)
        .send({
            message: `Need approval from ${e.umaServerParams.uri}.`,
            error: "uma_redirect",
            status: 401,
            info: {"server": e.umaServerParams}
          }
        );
      } else {
        GenericErrorHandler.handle(e, res, req);
      }
    }
}

async function checkPolicies(claims, permissions, policies) {
    const policyArray = Object.keys(policies).map((id) => policies[id]);
    const decision = SimplePolicyDecisionCombinerEngine.evaluate(claims, policyArray, policyTypeToEnginesMap);
    
    if (decision.authorization === "Deny") {
      throw {error: "policy_forbidden"};
    } else if (decision.authorization === "NotApplicable") {
      // failing safe on Deny if no applicable policies were found. This could be a configuration setting.
      throw {error: "policy_forbidden"};
    } else if (decision.authorization === "Permit") {
      return reconcilePermissionsAndObligations(permissions, decision.obligations);
    } else if (decision.authorization === "Indeterminate") {
      let ticket = "";
      
      const server =  decision.obligations[UMA_REDIRECT_OBLIGATION_ID];
      ticket = await registerUMAPermissions(server, permissions);
    
      throw {
        error: "uma_redirect",
        ticket: ticket,
        umaServerParams: server
      };
    }
}

async function registerUMAPermissions(server, permissions) {
    const protectionAPIKeyForUpstreamServer = UpstreamServers.protectionAPITokenFor(server.uri);
    const upstreamServerPermissionRegistrationEndpoint = server.uri + server.permission_registration_endpoint;
    if (! protectionAPIKeyForUpstreamServer) {
      throw {
        error: "uma_redirect_error",
        message: `Need approval from ${upstreamServerPermissionRegistrationEndpoint} but no API token found for communicating with this server.`
      };
    }
    const options = {
      method: "POST",
      json: true,
      uri: upstreamServerPermissionRegistrationEndpoint,
      headers: {"Authorization": `Bearer ${protectionAPIKeyForUpstreamServer}`},
      body: permissions
    };

    try {
      const response = await rp(options);
      if (! response.ticket) {
        throw {
          error: "uma_redirect_error",
          message: `Need approval from ${upstreamServerPermissionRegistrationEndpoint} but no ticket was returned.`
        };
      }
      return response.ticket;
    } catch (e) {
      throw {
        error: "uma_redirect_error",
        message: `Need approval from ${upstreamServerPermissionRegistrationEndpoint} but the following error occurred while contacting this server: ${e}.`
      };
    }
}

function reconcilePermissionsAndObligations (permissions, obligations) {
    const deniedScopes = obligations[DENY_SCOPES_OBLIGATION_ID];
    if (deniedScopes) {
      return permissions.map((permission) => (
        {
          resource_set_id: permission.resource_set_id,
          scopes: (permission.scopes || []).filter((scope) => (
            ! arrayDeepIncludes (deniedScopes, scope)
          ))
        }
      )).filter((permission) => (
        ((permission.scopes.length || 0) !== 0)
      ));
    } else {
      return permissions;
    }
}

function arrayDeepIncludes(array, thing) {
    const arrayHashes = array.map((element) => (hash(element)));
    return arrayHashes.includes(hash(thing));
}

async function introspectRPT(server, rpt) {
  const protectionAPIKeyForUpstreamServer = UpstreamServers.protectionAPITokenFor(server.uri);
  const upstreamServerIntrospectionEndpoint = server.uri + server.introspection_endpoint

  if (! protectionAPIKeyForUpstreamServer) {
    throw {
      error: "uma_introspection_error",
      message: `Need introspection from ${upstreamServerIntrospectionEndpoint} but no API token found for communicating with this server.`
    };
  }
  const options = {
    method: "POST",
    json: true,
    form: {
      token: rpt
    },
    headers: {"Authorization": `Bearer ${protectionAPIKeyForUpstreamServer}`},
    uri: upstreamServerIntrospectionEndpoint
  };
  let response = null;
  try {
    response = await rp(options);
  } catch (e) {
    throw {
      error: "uma_introspection_error",
      message: `Failed introspection attempt at ${upstreamServerIntrospectionEndpoint}:${e}`
    };
  }
  if (!response || !response.active || ! response.permissions) {
    throw {
      error: "uma_introspection_error",
      message: `Unsuccessful introspection attempt at ${upstreamServerIntrospectionEndpoint}`
    };
  }
  return response.permissions;
}

async function parseAndValidateClaimTokens(claimTokens) {
    if (!claimTokens || !claimTokens.length) {
      throw {
        error: "claims_error",
        message: "No claim tokens submitted.",
      };
    }
    let allClaims = {rpts: {}};
    for (let index = 0; index < claimTokens.length; index++) {
      const claimToken = claimTokens [index];
      if (claimToken.format === "jwt") {
        allClaims = {
          ...JWTClaimsToken.parse(claimToken.token),
          ...allClaims
        };
      } else if (claimToken.format === "rpt") {
        const rpt = claimToken.token;
        const serverInfo = claimToken.info;
        if (!serverInfo || !serverInfo.introspection_endpoint) {
          throw {
            error: "claims_error",
            message: "RPT claims must provide 'info.introspection_endpoint' to enable verificication."
          };
        }

        const introspectedPermissions = await introspectRPT(serverInfo, rpt);

        allClaims.rpts = {
          ...allClaims.rpts,
          [serverInfo.uri]: introspectedPermissions
        };
      } else {
        throw {
          error: "claims_error",
          message: `Unsupported claim format '${claimToken.format}'.`
        };
      }
    }
    return allClaims;
}

function validatePermissions(permissions) {
    if (!permissions) {
      throw {
        error: "invalid_ticket",
      };
    } else if (TimeStampedPermission.isExpired(permissions)) {
      throw {
        error: "expired_ticket",
      };
    }
}

function validateRPTRequest(request) {
    if (!request.body) {
      throw {
        error: "bad_request"
      }
    } else if (! request.body.ticket) {
      throw {
        error: "bad_request",
        message: "Bad Request. Expecting a ticket.",
      }
    }
}

module.exports = {
  create
};
