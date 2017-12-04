import { PolicyEngine, Policy, Claims } from "./PolicyEngine";
import { PolicyDecision, AuthorizationDecision, REDIRECT_OBLIGATION_ID } from "./Decisions";

export class WhiteListClientsPolicyEnginePolicy extends Policy {
    permittedClients: object[];
    deniedClients: object[];
    defaultAuthServer: string;
}

export class WhiteListClientsPolicyEngine extends PolicyEngine {
    public evaluate(claims: Claims, policy: WhiteListClientsPolicyEnginePolicy): PolicyDecision {
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

    private matches(claims: Claims, rules: object[]) {
        return rules
            .map((rule) => (
                Object.keys(rule)
                    .map((key) => (claims[key] === rule[key]))
                    .reduce((acc, current) => (acc && current), true)))
            .reduce((acc, current) => (acc || current), false);
    }
}

export default new WhiteListClientsPolicyEngine();