const _ = require("lodash");

const AuthzDecisionsPriorities = {
    "Deny": 3,
    "Indeterminate": 2,
    "Permit": 1,
    "NotApplicable": 0
};

function combineDecisionsDenyOverrides (decisions) {
    const combinedAuthDecisions = _.maxBy(decisions, (decision) => (AuthzDecisionsPriorities[decision.authorization]));
    const finalAuthorizationDecision = _.get(combinedAuthDecisions, "authorization") || "NotApplicable";
    
    let finalObligations = {};
    if (finalAuthorizationDecision === "Indeterminate" || finalAuthorizationDecision === "Permit") {
        const combinedObligations = decisions
            .filter((decision) => decision.authorization !== "NotApplicable")
            .map((decision) => decision.obligations);
        finalObligations = _.flatten(combinedObligations).reduce((sofar, thisObligation) => (
            { ...sofar , ...thisObligation}
        ), {});
    }
    
    return {
        authorization: finalAuthorizationDecision,
        obligations: finalObligations
    };
}

// deny-override
function evaluate(request, policies, engines) {
    const decisions = policies.map((policy) => (
        engines[policy.type].evaluate(request, policy)
    ));
    return combineDecisionsDenyOverrides(decisions);
}

module.exports = {
    evaluate,
    combineDecisionsDenyOverrides
};
