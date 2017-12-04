import { PolicyEngine, Policy, Claims } from "./PolicyEngine";
import { PolicyDecision, AuthorizationDecision, Obligation } from "./Decisions";

export class SimpleRule {
    name: string;
    ifMatch: {[key: string]: any}[];
    decision: PolicyDecision;
}

export class SimplePolicy extends Policy {
    content: {
        rules: {[ruleId: string]: SimpleRule};
        default: PolicyDecision;
    };
}

export function combineDecisionsDenyOverrides (decisions: PolicyDecision[]): PolicyDecision {
    const AuthzDecisionsPriorities = {
        "Deny": 3,
        "Indeterminate": 2,
        "Permit": 1,
        "NotApplicable": 0
    };
    const finalAuthorizationDecision: AuthorizationDecision = decisions
        .map((decision) => decision.authorization)
        .reduce((sofar, thisDecision) => (
            (AuthzDecisionsPriorities[sofar] >= AuthzDecisionsPriorities[thisDecision]) ? sofar : thisDecision
        ), AuthorizationDecision.NotApplicable);

    const finalObligations: Obligation[] = decisions
        .map((decision) => decision.obligations)
        .reduce((sofar, thisObligationArray) => (
            sofar.concat(thisObligationArray)
        ), []);
    return {
        authorization: finalAuthorizationDecision,
        obligations: (finalAuthorizationDecision === AuthorizationDecision.Indeterminate || finalAuthorizationDecision === AuthorizationDecision.Permit)
            ? finalObligations
            : []
    };
}

export class SimplePolicyEngine extends PolicyEngine {
    public evaluate(claims: Claims, policy: SimplePolicy): PolicyDecision {
        const policyDecisions: PolicyDecision[] = Object.keys(policy.content.rules).map((ruleId) => (
            SimplePolicyEngine.matches(claims, policy.content.rules[ruleId].ifMatch)
            ? policy.content.rules[ruleId].decision
            : {authorization: AuthorizationDecision.NotApplicable, obligations: []}
        ));

        const finalDecision: PolicyDecision = combineDecisionsDenyOverrides(policyDecisions);

        if (finalDecision.authorization === AuthorizationDecision.NotApplicable) {
            return policy.content.default;
        } else {
            return finalDecision;
        }
    }

    private static matches(claims: Claims, rules: object[]): boolean {
        return rules
            .map((rule) => (
                Object.keys(rule)
                    .map((key) => (claims[key] === rule[key]))
                    .reduce((acc, current) => (acc && current), true)))
            .reduce((acc, current) => (acc || current), false);
    }
}