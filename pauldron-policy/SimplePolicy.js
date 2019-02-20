const SimpleRule = require("./SimpleRule");

function validate(policy) {
    if (!policy || !policy.type) {
        throw {
            error: "invalid_policy",
            message: "Must have 'type'."
        };
    } else if (!policy.content
        || !policy.content.rules
        || !(policy.content.rules instanceof Object)
        || (Object.keys(policy.content.rules)).length === 0) {
            throw {
                error: "invalid_policy",
                message: "Must have 'content' with non-empty 'rules' object."
            };
    } else {
        Object.keys(policy.content.rules).forEach(ruleId => {
            try {
                SimpleRule.validate(policy.content.rules[ruleId]);
            } catch (e) {
                throw {
                    error: "invalid_policy",
                    message: `Error in 'rule' ${ruleId}: ${e.message}`
                };
            }
        });
    }
    return true;
}

module.exports = {
    validate
}
