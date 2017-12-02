import { PolicyDecision } from "./Decisions";

export class Policy {
    type: string;
    content: object;
}

export abstract class PolicyEngine {
    public abstract evaluate (request: {[id: string]: any}, policies: Policy[] | Policy): PolicyDecision;
}