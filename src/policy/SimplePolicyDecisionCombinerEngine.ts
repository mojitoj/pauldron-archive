import { PolicyDecision, AuthorizationDecision, Obligation } from "./Decisions";
import { Claims, Policy, PolicyEngine, PolicyDecionCombinerEngine } from "./PolicyEngine";

const authzDecisionsPriorities = {
    "Deny": 3,
    "Indeterminate": 2,
    "Permit": 1,
    "NotApplicable": 0
};

export class SimplePolicyDecisionCombinerEngine extends PolicyDecionCombinerEngine {
    public evaluate (request: Claims, policies: Policy[], engines: {[policyType: string]: PolicyEngine}): PolicyDecision {
        const decisions: PolicyDecision[] = policies.map((policy) => (
            engines[policy.type].evaluate(request, policy)
        ));
        const finalAuthorizationDecision: AuthorizationDecision = decisions.map((decision) => decision.authorization)
            .reduce((sofar, thisDecision) => (
                (authzDecisionsPriorities[sofar] >= authzDecisionsPriorities[thisDecision]) ? sofar : thisDecision
            ), AuthorizationDecision.NotApplicable);
        const finalObligations: Obligation[] = decisions.map((decision) => decision.obligations)
            .reduce((sofar, thisObligationArray) => (
                sofar.concat(thisObligationArray)
            ), []);
        return {
            authorization: finalAuthorizationDecision,
            obligations: finalObligations
        };
    }
}

export default new SimplePolicyDecisionCombinerEngine();