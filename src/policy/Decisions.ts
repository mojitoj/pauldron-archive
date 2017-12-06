export enum AuthorizationDecision {
    Permit = "Permit",
    Deny = "Deny",
    Indeterminate = "Indeterminate",
    NotApplicable = "NotApplicable"
}
export type Obligations = {[id: string]: any};

export class PolicyDecision {
    authorization: AuthorizationDecision;
    obligations: Obligations;
}

