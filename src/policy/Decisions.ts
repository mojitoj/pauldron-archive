export enum AuthorizationDecision {
    Permit = "Permit",
    Deny = "Deny",
    Indeterminate = "Indeterminate",
    NotApplicable = "NotApplicable"
}
export class Obligation {
    id: string;
    params: {[id: string]: string};
}
export class PolicyDecision {
    authorization: AuthorizationDecision;
    obligations: Obligation[];
}