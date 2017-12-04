import * as mocha from "mocha";
import * as chai from "chai";
import {WhiteListClientsPolicyEnginePolicy} from "./WhiteListClientsPolicyEngine";
import policyEngine from "./WhiteListClientsPolicyEngine";
import { PolicyDecision, AuthorizationDecision, REDIRECT_OBLIGATION_ID } from "./Decisions";

const policy: WhiteListClientsPolicyEnginePolicy = require("../whitelist-clients-policy-engine-policy.json").content;

describe("whitelist clients policy engine", () => {
        it("must allow a whitelisted clientId", () => {
            const claims = {client_id: "client1"};
            const decision: PolicyDecision = policyEngine.evaluate(claims, policy);
            chai.assert.equal(decision.authorization, AuthorizationDecision.Permit);
        });

        it("must deny a blacklisted clientId", () => {
            const claims = {client_id: "client2", organization: "org1"};
            const decision: PolicyDecision = policyEngine.evaluate(claims, policy);
            chai.assert.equal(decision.authorization, AuthorizationDecision.Deny);
        });

        it("must redirect any other clientIds", () => {
            const claims = {client_id: "client3"};
            const decision: PolicyDecision = policyEngine.evaluate(claims, policy);
            chai.assert.equal(decision.authorization, AuthorizationDecision.Indeterminate);
            chai.assert.equal(decision.obligations[0].id, REDIRECT_OBLIGATION_ID);
        });
    });
