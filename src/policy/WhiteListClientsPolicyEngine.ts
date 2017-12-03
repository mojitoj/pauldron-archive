import { PolicyEngine, Policy } from "./PolicyEngine";
import { PolicyDecision, AuthorizationDecision, REDIRECT_OBLIGATION_ID } from "./Decisions";

export class WhiteListClientsPolicyEnginePolicy extends Policy {
    permittedClients: object[];
    deniedClients: object[];
    defaultAuthServer: string;
}

export class WhiteListClientsPolicyEngine extends PolicyEngine {
    public evaluate(claims: {[id: string]: any}, policy: WhiteListClientsPolicyEnginePolicy): PolicyDecision {
        const notApplicableDecision: PolicyDecision = {authorization: AuthorizationDecision.NotApplicable, obligations: []};
        const permitDecision: PolicyDecision = {authorization: AuthorizationDecision.Permit, obligations: []};
        const denyDecision: PolicyDecision = {authorization: AuthorizationDecision.Deny, obligations: []};
        const redirectDecision: PolicyDecision = {
            authorization: AuthorizationDecision.Indeterminate,
            obligations: [{
                    id: REDIRECT_OBLIGATION_ID,
                    params: {"uma_server": policy.defaultAuthServer}
                }]
        };

        if (policy.deniedClients && this.matches(claims, policy.deniedClients)) {
            return denyDecision;
        } else if (policy.permittedClients && this.matches(claims, policy.permittedClients)) {
            return permitDecision;
        } else {
            return redirectDecision;
        }
    }

    private matches(claims: {[id: string]: any}, rules: object[]) {
        return rules
            .map((rule, ruleIndex) => (
                Object.keys(rule)
                    .map((key) => (claims[key] === rule[key]))
                    .reduce((previous, current) => (previous && current))))
            .reduce((previous, current) => (previous || current));
    }
}

export default new WhiteListClientsPolicyEngine();