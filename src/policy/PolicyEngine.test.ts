import * as mocha from "mocha";
import * as chai from "chai";
import { SimplePolicy, SimplePolicyEngine } from "./SimplePolicyEngine";
import { PolicyDecision, AuthorizationDecision } from "./Decisions";
import _ = require("lodash");
import simplePolicyDecisionCombinerEngine from "./SimplePolicyDecisionCombinerEngine";
import { UMA_REDIRECT_OBLIGATION_ID } from "../routes/AuthorizationEndpoint";

const simplePolicyEngine = new SimplePolicyEngine();

const policyTypeToEnginesMap = {
    "pauldron:simple-policy": simplePolicyEngine
};

let policy: SimplePolicy = require("../simple-policy.json");

describe("simple policy combiner engine", () => {

    it("must return NotApplicable on empty", () => {
        const claims = {client_id: "client1"};
        const decision: PolicyDecision = simplePolicyDecisionCombinerEngine.evaluate(claims, [], {});
        chai.assert.equal(decision.authorization, AuthorizationDecision.NotApplicable);
    });

    it("must return Deny on Permit, Indeterminate, and Deny and combine obligations", () => {
        let permittingPolicy: SimplePolicy = _.cloneDeep(policy);
        let denyingPolicy: SimplePolicy = _.cloneDeep(policy);
        denyingPolicy.content.rules.permittedClients.ifMatch = [];
        denyingPolicy.content.rules.deniedClients.ifMatch = [{client_id: "client1"}];

        let indeterminatePolicy: SimplePolicy = _.cloneDeep(policy);
        denyingPolicy.content.rules.permittedClients.ifMatch = [];

        const claims = {client_id: "client1"};
        const decision: PolicyDecision = simplePolicyDecisionCombinerEngine.evaluate(claims,
            [denyingPolicy, permittingPolicy, indeterminatePolicy],
            policyTypeToEnginesMap);
        chai.assert.equal(decision.authorization, AuthorizationDecision.Deny);
    });
});


describe("simple policy engine", () => {
        it("must allow a whitelisted clientId", () => {
            const claims = {client_id: "client1"};
            const decision: PolicyDecision = simplePolicyEngine.evaluate(claims, policy);
            chai.assert.equal(decision.authorization, AuthorizationDecision.Permit);
        });

        it("must deny a blacklisted clientId", () => {
            const claims = {client_id: "client2", organization: "org1"};
            const decision: PolicyDecision = simplePolicyEngine.evaluate(claims, policy);
            chai.assert.equal(decision.authorization, AuthorizationDecision.Deny);
        });

        it("must redirect any other clientIds", () => {
            const claims = {client_id: "client3"};
            const decision: PolicyDecision = simplePolicyEngine.evaluate(claims, policy);
            chai.assert.equal(decision.authorization, AuthorizationDecision.Indeterminate);
            chai.assert.hasAnyKeys(decision.obligations, [UMA_REDIRECT_OBLIGATION_ID]);
        });
});
