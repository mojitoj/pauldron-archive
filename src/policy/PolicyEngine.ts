import { PolicyDecision, AuthorizationDecision, Obligation } from "./Decisions";

export type Claims = {[id: string]: any};

export class Policy {
    type: string;
    name: string;
    content: any;
}

export abstract class PolicyEngine {
    public abstract evaluate (request: Claims, policy: Policy): PolicyDecision;
}

export abstract class PolicyDecionCombinerEngine {
    public abstract evaluate (request: Claims, policies: Policy[], engines: {[type: string]: PolicyEngine}): PolicyDecision;
}


