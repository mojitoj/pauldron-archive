const _ = require("lodash");
const db = require("../lib/db");
const logger = require ("../lib/logger");

const {reconcilePermissionsAndObligations} = require("../lib/permission-handler");

const TimeStampedPermission = require("../model/TimeStampedPermission");
const JWTClaimsToken = require("../lib/jwt-claims-token");
const APIAuthorization = require("../lib/api-authorization");
const GenericErrorHandler = require("./error-handler");

const {SimplePolicyDecisionCombinerEngine} = require ("pauldron-policy");
const {policyTypeToEnginesMap} = require("./policy-endpoint");

const JWT_BEARER_CLIENT_ASSERTION_TYPE= "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

const TOKEN_TTL = parseInt(process.env.RPT_TTL) || 20;

async function create(req, res, next) {
    try {
        const realm = APIAuthorization.validate(req, ["AUTH:C"]);

        await validateTokenRequest(req);

        const policies = await db.Policies.list(realm);

        const claimToken = req.body.client_assertion;
        const claims = JWTClaimsToken.parse(claimToken);

        const permissions = JSON.parse(req.body.scope);

        const permissionsAfterReconciliationWithPolicies = 
          await checkPolicies(claims, permissions, policies);

        const token = TimeStampedPermission.issue(
            TOKEN_TTL, 
            permissionsAfterReconciliationWithPolicies, 
            realm
        );

        await db.RPTs.add(realm, token.id, token);

        res.status(201).send({token: token.id});
    } catch (e) {
        GenericErrorHandler.handle(e, res, req);
    }
}

async function checkPolicies(claims, permissions, policies) {
    const policyArray = _.values(policies);
    const decision = SimplePolicyDecisionCombinerEngine.evaluate(claims, policyArray, policyTypeToEnginesMap);

    if (decision.authorization === "Permit") {
        const grantedPermissions = reconcilePermissionsAndObligations(permissions, decision.obligations);
        if (!grantedPermissions || !grantedPermissions.length) {
            logger.debug("Rejecting token request because to permissions could be granted.");
            throw {
                error: "policy_forbidden"
            };
        }
        return grantedPermissions;
    } else {
        throw {
            error: "policy_forbidden"
        }; //fail safe for anything other than an explicit permit
    }
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
