const _ = require("lodash");
const superagent = require("superagent");
const db = require("../lib/db");

const logger = require("../lib/logger");
const {
  reconcilePermissionsAndObligations,
  validatePermissions
} = require("../lib/permission-handler");

const TimeStampedPermission = require("../model/TimeStampedPermission");
const UpstreamServers = require("../lib/upstream-servers");
const APIAuthorization = require("../lib/api-authorization");
const GenericErrorHandler = require("./error-handler");
const JWTClaimsToken = require("../lib/jwt-claims-token");

const { SimplePolicyDecisionCombinerEngine } = require("pauldron-policy");
const { policyTypeToEnginesMap } = require("./policy-endpoint");

const UMA_REDIRECT_OBLIGATION_ID = "UMA_REDIRECT";

// ClaimToken {
//   format;
//   token;
//   info;
// }
const rptTTL = parseInt(process.env.RPT_TTL) || 20;

async function create(req, res, next) {
  try {
    const realm = APIAuthorization.validate(req, ["AUTH:C"]);

    await validateRPTRequest(req);

    const policies = await db.Policies.list(realm);

    const ticket = req.body.ticket;

    const claimsTokens = req.body.claim_tokens;
    const claims = await parseAndValidateClaimTokens(claimsTokens);

    const permission = await db.Permissions.get(realm, ticket);
    validatePermissions(permission, "ticket");

    const permissionsAfterReconciliationWithPolicies = await checkPolicies(
      claims,
      permission.permissions,
      policies
    );

    const rpt = TimeStampedPermission.issue(
      rptTTL,
      permissionsAfterReconciliationWithPolicies,
      permission.realm
    );

    await db.RPTs.add(realm, rpt.id, rpt);

    await db.Permissions.del(realm, ticket);

    res.status(201).send({ rpt: rpt.id });
  } catch (e) {
    if (e && e.error === "uma_redirect") {
      res
        .status(401)
        .set(
          "WWW-Authenticate",
          `UMA realm=\"${e.umaServerParams.realm}\", as_uri=\"${e.umaServerParams.uri}\", ticket=\"${e.ticket}\"`
        )
        .send({
          message: `Need approval from ${e.umaServerParams.uri}.`,
          error: "uma_redirect",
          status: 401,
          info: { server: e.umaServerParams }
        });
    } else {
      GenericErrorHandler.handle(e, res, req);
    }
  }
}

async function checkPolicies(claims, permissions, policies) {
  const policyArray = _.values(policies);
  const decision = SimplePolicyDecisionCombinerEngine.evaluate(
    claims,
    policyArray,
    policyTypeToEnginesMap
  );

  const authorizationDecision = decision.authorization;

  if (
    !authorizationDecision ||
    authorizationDecision === "Deny" ||
    authorizationDecision === "NotApplicable"
  ) {
    // failing safe to Deny if no applicable policies were found. This could be a configuration setting.
    throw {
      error: "policy_forbidden"
    };
  } else if (decision.authorization === "Permit") {
    const grantedPermissions = reconcilePermissionsAndObligations(
      permissions,
      decision.obligations
    );
    if (!grantedPermissions || !grantedPermissions.length) {
      logger.debug(
        "Rejecting RPT request because to permissions could be granted."
      );
      throw {
        error: "policy_forbidden"
      };
    }
    return grantedPermissions;
  } else if (decision.authorization === "Indeterminate") {
    const server = decision.obligations[UMA_REDIRECT_OBLIGATION_ID];
    const ticket = await registerUMAPermissions(server, permissions);

    throw {
      error: "uma_redirect",
      ticket: ticket,
      umaServerParams: server
    };
  }
}

async function registerUMAPermissions(server, permissions) {
  const protectionAPIKeyForUpstreamServer =
    UpstreamServers.protectionAPITokenFor(server.uri);
  const upstreamServerPermissionRegistrationEndpoint =
    server.uri + server.permission_registration_endpoint;
  if (!protectionAPIKeyForUpstreamServer) {
    throw {
      error: "uma_redirect_error",
      message: `Need approval from ${upstreamServerPermissionRegistrationEndpoint} but no API token found for communicating with this server.`
    };
  }

  try {
    const response = await superagent
      .post(upstreamServerPermissionRegistrationEndpoint)
      .set("Authorization", `Bearer ${protectionAPIKeyForUpstreamServer}`)
      .send(permissions);
    if (!response.body.ticket) {
      throw {
        error: "uma_redirect_error",
        message: `Need approval from ${upstreamServerPermissionRegistrationEndpoint} but no ticket was returned.`
      };
    }
    return response.body.ticket;
  } catch (e) {
    throw {
      error: "uma_redirect_error",
      message: `Need approval from ${upstreamServerPermissionRegistrationEndpoint} but the following error occurred while contacting this server: ${e}.`
    };
  }
}

async function introspectRPT(server, rpt) {
  const protectionAPIKeyForUpstreamServer =
    UpstreamServers.protectionAPITokenFor(server.uri);
  const upstreamServerIntrospectionEndpoint =
    server.uri + server.introspection_endpoint;

  if (!protectionAPIKeyForUpstreamServer) {
    throw {
      error: "uma_introspection_error",
      message: `Need introspection from ${upstreamServerIntrospectionEndpoint} but no API token found for communicating with this server.`
    };
  }

  try {
    const httpResponse = await superagent
      .post(upstreamServerIntrospectionEndpoint)
      .type("form")
      .set("Authorization", `Bearer ${protectionAPIKeyForUpstreamServer}`)
      .send({ token: rpt });
    const response = httpResponse.body;
    if (!response || !response.active || !response.permissions) {
      throw {
        error: "uma_introspection_error",
        message: `Unsuccessful introspection attempt at ${upstreamServerIntrospectionEndpoint}`
      };
    }
    return response.permissions;
  } catch (e) {
    throw {
      error: "uma_introspection_error",
      message: `Failed introspection attempt at ${upstreamServerIntrospectionEndpoint}:${e}`
    };
  }
}

async function parseAndValidateClaimTokens(claimTokens) {
  claimTokens = claimTokens || [];

  let allClaims = { rpts: {} };
  for (let index = 0; index < claimTokens.length; index++) {
    const claimToken = claimTokens[index];
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
          message:
            "RPT claims must provide 'info.introspection_endpoint' to enable verificication."
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

const yup = require("yup");
const schema = yup.object().shape({
  ticket: yup.string().required(),
  claim_tokens: yup
    .array()
    .of(
      yup.object().shape({
        format: yup.string().required(),
        token: yup.string().required()
      })
    )
    .required()
});

async function validateRPTRequest(request) {
  try {
    await schema.validate(request.body);
  } catch (e) {
    logger.info(`bad token ${e}`);
    console.log(e);
    throw {
      error: "bad_request",
      message: `Bad Request. ${_.join(e.errors, ", ")}.`
    };
  }
}

module.exports = {
  create
};
