import * as mocha from "mocha";
import * as chai from "chai";
import {WhiteListClientsPolicyEnginePolicy, WhiteListClientsPolicyEngine} from "./WhiteListClientsPolicyEngine";
import whiteListClientsPolicyEngine from "./WhiteListClientsPolicyEngine";
import { PolicyDecision, AuthorizationDecision, REDIRECT_OBLIGATION_ID } from "./Decisions";
import _ = require("lodash");
import simplePolicyDecisionCombinerEngine from "./SimplePolicyDecisionCombinerEngine";

const policyTypeToEnginesMap = {
    "pauldron:whitelist-clitents-policy": new WhiteListClientsPolicyEngine()
};

let policy: WhiteListClientsPolicyEnginePolicy = require("../whitelist-clients-policy-engine-policy.json");

describe("simple policy combiner engine", () => {

    it("must return NotApplicable on empty", () => {
        const claims = {client_id: "client1"};
        const decision: PolicyDecision = simplePolicyDecisionCombinerEngine.evaluate(claims, [], {});
        chai.assert.equal(decision.authorization, AuthorizationDecision.NotApplicable);
    });

    it("must return Deny on Permit, Indeterminate, and Deny and combine obligations", () => {
        let permittingPolicy = _.cloneDeep(policy);
        let denyingPolicy = _.cloneDeep(policy);
        denyingPolicy.content.permittedClients = [];
        denyingPolicy.content.deniedClients = [{client_id: "client1"}];

        let indeterminatePolicy = _.cloneDeep(policy);
        denyingPolicy.content.permittedClients = [];

        const claims = {client_id: "client1"};
        const decision: PolicyDecision = simplePolicyDecisionCombinerEngine.evaluate(claims,
            [denyingPolicy, permittingPolicy, indeterminatePolicy],
            policyTypeToEnginesMap);
        chai.assert.equal(decision.authorization, AuthorizationDecision.Deny);
    });
});


describe("whitelist clients policy engine", () => {
        it("must allow a whitelisted clientId", () => {
            const claims = {client_id: "client1"};
            const decision: PolicyDecision = whiteListClientsPolicyEngine.evaluate(claims, policy);
            chai.assert.equal(decision.authorization, AuthorizationDecision.Permit);
        });

        it("must deny a blacklisted clientId", () => {
            const claims = {client_id: "client2", organization: "org1"};
            const decision: PolicyDecision = whiteListClientsPolicyEngine.evaluate(claims, policy);
            chai.assert.equal(decision.authorization, AuthorizationDecision.Deny);
        });

        it("must redirect any other clientIds", () => {
            const claims = {client_id: "client3"};
            const decision: PolicyDecision = whiteListClientsPolicyEngine.evaluate(claims, policy);
            chai.assert.equal(decision.authorization, AuthorizationDecision.Indeterminate);
            chai.assert.equal(decision.obligations[0].id, REDIRECT_OBLIGATION_ID);
        });
});
