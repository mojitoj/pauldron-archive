import { PolicyEngine, Policy } from "./PolicyEngine";
import { PolicyDecision, AuthorizationDecision, REDIRECT_OBLIGATION_ID } from "./Decisions";

export class WhiteListClientsPolicyEnginePolicy extends Policy {
    clientIdClaimId: string;
    permittedClients: string[];
    deniedClients: string[];
    defaultAuthServer: string;
}

export class WhiteListClientsPolicyEngine extends PolicyEngine {
    public evaluate(request: {[id: string]: any}, policy: WhiteListClientsPolicyEnginePolicy): PolicyDecision {
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

        if (policy.clientIdClaimId) {
            const clientId: string = request[policy.clientIdClaimId];
            if (!clientId) {
                return notApplicableDecision;
            }
            if (policy.deniedClients && policy.deniedClients.indexOf(clientId) > 0) {
                return denyDecision;
            } else if (policy.permittedClients && policy.permittedClients.indexOf(clientId) > 0) {
                return permitDecision;
            } else {
                return redirectDecision;
            }
        } else {
            return notApplicableDecision;
        }
    }
}

export default new WhiteListClientsPolicyEngine();