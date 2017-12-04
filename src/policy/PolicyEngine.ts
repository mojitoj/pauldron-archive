import { PolicyDecision } from "./Decisions";

export type Claims = {[id: string]: any};

export class Policy {
    type: string;
    content: any;
}

export abstract class PolicyEngine {
    public abstract evaluate (request: Claims, policies: Policy[] | Policy): PolicyDecision;
}