const hash = require("object-hash");
const db = require("../lib/db");
const logger = require ("../lib/logger");

const TimeStampedPermission = require("../model/TimeStampedPermission");
const JWTClaimsToken = require("../lib/jwt-claims-token");
const APIAuthorization = require("../lib/api-authorization");
const GenericErrorHandler = require("./error-handler");

const {SimplePolicyDecisionCombinerEngine} = require ("pauldron-policy");
const {policyTypeToEnginesMap} = require("./policy-endpoint");

const DENY_SCOPES_OBLIGATION_ID = "DENY_SCOPES";

const JWT_BEARER_CLIENT_ASSERTION_TYPE= "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

const TOKEN_TTL = parseInt(process.env.RPT_TTL) || 20;

async function create(req, res, next) {
    try {
        const user = APIAuthorization.validate(req, ["AUTH:C"]);

        validateRPTRequest(req);

        const policies = await db.Policies.list(user);

        const claimToken = req.body.client_assertion;
        const claims = JWTClaimsToken.parse(claimToken);

        const permissions = JSON.parse(req.body.scope);

        const permissionsAfterReconciliationWithPolicies = 
          await checkPolicies(claims, permissions, policies);

        const token = TimeStampedPermission.issue(
            TOKEN_TTL, 
            permissionsAfterReconciliationWithPolicies, 
            user
        );

        await db.RPTs.add(user, token.id, token);

        res.status(201).send({token: token.id});
    } catch (e) {
        GenericErrorHandler.handle(e, res, req);
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
        throw {error: "policy_forbidden"};
    }
}

function reconcilePermissionsAndObligations (permissions, obligations) {
    const deniedScopes = obligations[DENY_SCOPES_OBLIGATION_ID];
    if (deniedScopes) {
      return permissions.map(
          (permission) => (
            {
                resource_set_id: permission.resource_set_id,
                scopes: (permission.scopes || []).filter(
                    (scope) => (! arrayDeepIncludes (deniedScopes, scope))
                )
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

function validateRPTRequest(request) {
    if (!request.body) {
      throw {
        error: "bad_request"
      }
    } else if (! request.body.client_assertion_type) {
      throw {
        error: "bad_request",
        message: "Bad Request. Expecting 'client_assertion_type'.",
      }
    } else if (request.body.client_assertion_type !== JWT_BEARER_CLIENT_ASSERTION_TYPE) {
        throw {
            error: "bad_request",
            message: `Bad Request. Only ${JWT_BEARER_CLIENT_ASSERTION_TYPE} is supported for 'client_assertion_type'.`,
        }
    } else if (! request.body.grant_type) {
        throw {
            error: "bad_request",
            message: "Bad Request. Expecting 'grant_type'.",
        }
    } else if (request.body.grant_type !=="client_credentials") {
        throw {
          error: "bad_request",
          message: "Bad Request. Only 'client_credentials' is supported for 'client_assertion'.",
        }
    } else if (! request.body.client_assertion) {
        throw {
          error: "bad_request",
          message: "Bad Request. Expecting 'client_assertion'.",
        }
    } else if (! request.body.scope) {
        throw {
          error: "bad_request",
          message: "Bad Request. Expecting 'scope'.",
        }
    }
}

module.exports = {
    create
};
