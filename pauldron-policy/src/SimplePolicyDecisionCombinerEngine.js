 
function combineDecisionsDenyOverrides (decisions) {
    const AuthzDecisionsPriorities = {
        "Deny": 3,
        "Indeterminate": 2,
        "Permit": 1,
        "NotApplicable": 0
    };
    const finalAuthorizationDecision = decisions
        .map((decision) => decision.authorization)
        .reduce((sofar, thisDecision) => (
            (AuthzDecisionsPriorities[sofar] >= AuthzDecisionsPriorities[thisDecision]) ? sofar : thisDecision
        ), "NotApplicable");

    const finalObligations = decisions
        .map((decision) => decision.obligations)
        .reduce((sofar, thisObligation) => (
            { ...sofar , ...thisObligation}
        ), {});
    return {
        authorization: finalAuthorizationDecision,
        obligations: (finalAuthorizationDecision === "Indeterminate" || finalAuthorizationDecision === "Permit")
            ? finalObligations
            : {}
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
