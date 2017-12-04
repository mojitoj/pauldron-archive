import { PolicyDecision, AuthorizationDecision, Obligation } from "./Decisions";
import { Claims, Policy, PolicyEngine, PolicyDecionCombinerEngine } from "./PolicyEngine";
import {combineDecisionsDenyOverrides} from "./SimplePolicyEngine";


// deny-override
export class SimplePolicyDecisionCombinerEngine extends PolicyDecionCombinerEngine {
    public evaluate (request: Claims, policies: Policy[], engines: {[policyType: string]: PolicyEngine}): PolicyDecision {
        const decisions: PolicyDecision[] = policies.map((policy) => (
            engines[policy.type].evaluate(request, policy)
        ));
        return combineDecisionsDenyOverrides(decisions);
    }
}

export default new SimplePolicyDecisionCombinerEngine();