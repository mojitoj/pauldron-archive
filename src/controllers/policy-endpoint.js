const { SimplePolicyEngine, SimplePolicy } = require("pauldron-policy");
const db = require("../lib/db");

const hash = require("object-hash");
const APIAuthorization = require("../lib/api-authorization");
const GenericErrorHandler = require("./error-handler");

const policyTypeToEnginesMap = {
    "pauldron:simple-policy": new SimplePolicyEngine()
};

const policyTypeToValidator = {
    "pauldron:simple-policy": SimplePolicy.validatePolicy
};

async function create(req, res, next) {
    try {
        const user = APIAuthorization.validate(req, ["POL:C"]);
        validateNewPolicyRequestParams(req.body);
        const policy = req.body;
        const id = hash(policy);
        let maybeExistingPolicy = await db.Policies.get(user, id);
        if (! maybeExistingPolicy) {
            await db.Policies.add(user, id, policy);
            res.status(201).send(
                {
                    "id": id,
                    ... policy
                }
            );

        } else {
            res.status(200).send(
                {
                    "id": id,
                    ... policy
                }
            );
        }
    } catch (e) {
        GenericErrorHandler.handle(e, res, req);
    }
}

async function list(req, res, next) {
    try {
        const user = APIAuthorization.validate(req, ["POL:L"], req.app.locals.serverConfig);
        const policies = await db.Policies.list(user);
        res.status(200).send(Object.keys(policies)
            .map((id) => (
                {
                    "id": id,
                    ... policies[id]
                }
            ))
        );
    } catch (e) {
        GenericErrorHandler.handle(e, res, req);
    }
}

async function get(req, res, next) {
    try {
        const user = APIAuthorization.validate(req, ["POL:R"], req.app.locals.serverConfig);
        const id = req.params.id;
        const policy = await db.Policies.get(user, id);

        if (policy) {
            res.status(200).send({
                "id": id,
                ... policy
            });
        } else {
            throw {
                error: "object_not_found",
                message: `No policy exists by the id '${id}'.`
            };
        }
    } catch (e) {
        GenericErrorHandler.handle(e, res, req);
    }
}

async function del(req, res, next) {
    try {
        const user = APIAuthorization.validate(req, ["POL:D"]);
        const id = req.params.id;
        const policy = await db.Policies.get(user, id);
        if (policy) {
            await db.Policies.del(user, id);
            res.status(204).send();
        } else {
            throw {
                error: "object_not_found",
                message: `No policy exists by the id '${id}'.`
            };
        }
    } catch (e) {
        GenericErrorHandler.handle(e, res, req);
    }
}

function validateNewPolicyRequestParams(policy) {
    const validationError = {
        error: "bad_request"
    };

    if (!policy) {
        validationError.message = "Must provide a Policy.";
        throw validationError;
    } else if (! policy.type || ! (policy.type.length > 0 )) {
        validationError.message = "Expecting a valid 'type'.";
        throw validationError;
    } else if (! Object.keys(policyTypeToEnginesMap).includes(policy.type)) {
        validationError.message = `The server does not support policy type ${policy.type}. Current supported formats: ${Object.keys(policyTypeToEnginesMap).join(",")}`;
        throw validationError;
    } else if (! Object.keys(policyTypeToValidator).includes(policy.type)) {
        validationError.message = `Could not find the validator for policy type ${policy.type}.`;
        throw validationError;        
    }
    try {
        policyTypeToValidator[policy.type].call(null, policy);
    } catch (e) {
        validationError.message = `Invalid policy: ${e.message}`;
        throw validationError;
    }
    // todo more validation based on the type. Each type must have its own validator to be called.
}

module.exports = {
    create,
    list,
    get,
    del,
    policyTypeToEnginesMap
};

