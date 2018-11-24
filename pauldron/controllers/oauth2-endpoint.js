const _ = require("lodash");
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

        await validateTokenRequest(req);

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
    
    if (decision.authorization === "Permit") {
        return reconcilePermissionsAndObligations(permissions, decision.obligations);
    } else {
        throw {error: "policy_forbidden"}; //fail safe for anything other than an explicit permit
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

const yup = require("yup");
const schema = yup.object().shape({
    grant_type: yup.string().required(),
    client_assertion_type: yup.string().required(),
    client_assertion: yup.string().required(),
    scope: yup.string().required(),
});

async function validateTokenRequest(request) {  
    try {
        await schema.validate(request.body);
    } catch (e) {
        throw {
            error: "bad_request",
            message: `Bad Request. ${_.join(e.errors, ", ")}.`
        }    
    }
    if (request.body.client_assertion_type !== JWT_BEARER_CLIENT_ASSERTION_TYPE) {
        throw {
            error: "bad_request",
            message: `Bad Request. Currently, only ${JWT_BEARER_CLIENT_ASSERTION_TYPE} is supported for 'client_assertion_type'.`,
        }
    } else if (request.body.grant_type !=="client_credentials") {
        throw {
            error: "bad_request",
            message: "Bad Request. Currently, only 'client_credentials' is supported for 'grant_type'.",
        }
    }
}

module.exports = {
    create
};
