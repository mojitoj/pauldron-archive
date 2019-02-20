
const _ = require("lodash");
const {combineDecisionsDenyOverrides} = require("./SimplePolicyDecisionCombinerEngine");


function evaluate(claims, policy) {
    const policyDecisions = Object.keys(policy.content.rules).map((ruleId) => (
        matchesRule(claims, policy.content.rules[ruleId])
        ? policy.content.rules[ruleId].decision
        : {authorization: "NotApplicable", obligations: []}
    ));

    const finalDecision = combineDecisionsDenyOverrides(policyDecisions);

    if (finalDecision.authorization === "NotApplicable") {
        return policy.content.default;
    } else {
        return finalDecision;
    }
}

function matchesRule(claims, rule) {
    const matchesRuleSignature =
        (rule.matchAnyOf.map((rule) => (
                Object.keys(rule)
                    .map((key) => (_.isEqual(claims[key], rule[key])))
                    .reduce((acc, current) => (acc && current), true))
        ).reduce((acc, current) => (acc || current), false));

    const matchesCondition = (!rule.condition) || evaluateCondition(claims, rule.condition);

    return matchesRuleSignature && matchesCondition;
}

function evaluateCondition(claims, condition) {
    const functionText = `
        'use strict';
            try {
            if (${condition})
                return true;
            else
                return false;
            } catch (e) {
                return false;
            }
        `;
    const func = new Function(Object.keys(claims).join(","), functionText);
    return func.apply(null, Object.keys(claims).map((key) => (claims[key])));
}

module.exports = {
    evaluate
}
