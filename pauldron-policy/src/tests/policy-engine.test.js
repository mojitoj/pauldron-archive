
const SimplePolicyEngine = require("../SimplePolicyEngine");
const SimplePolicy = require("../SimplePolicy");
const SimplePolicyDecisionCombinerEngine = require("../SimplePolicyDecisionCombinerEngine");

const _ = require("lodash");

const policyTypeToEnginesMap = {
    "pauldron:simple-policy": SimplePolicyEngine
};

let policy = require("./fixtures/simple-policy.json");


describe("simple policy engine", () => {
    it ("must be able to detect malformed policies" , () => {
        expect.assertions(3);
        let wrongPolicy = _.cloneDeep(policy);
        delete wrongPolicy.type;
        let result = false;
        try {
            result = SimplePolicy.validate(wrongPolicy);
        } catch (e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("invalid_policy");
        }
        expect(result).toBe(false);
    });

    it ("must be able to reject gibberish conditions" , () => {
        expect.assertions(3);

        let wrongPolicy = _.cloneDeep(policy);
        let result = false;
        try {
            wrongPolicy.content.rules["permittedClientsBasedOnPurpose"].condition = "gibberish)(;";
            result = SimplePolicy.validate(wrongPolicy);
        } catch (e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("invalid_policy");
        }
        expect(result).toBe(false);
    });

    it ("must be able to reject gibberish conditions" , () => {
        expect.assertions(3);

        let wrongPolicy = _.cloneDeep(policy);
        let result = false;
        try {
            wrongPolicy.content.rules["permittedClientsBasedOnPurpose"].condition = "gibberish)(;";
            result = SimplePolicy.validate(wrongPolicy);
        } catch (e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("invalid_policy");
        }
        expect(result).toBe(false);
    });

    it ("must be able to reject empty conditions" , () => {
        expect.assertions(3);

        let wrongPolicy = _.cloneDeep(policy);
        let result = false;
        try {
            wrongPolicy.content.rules["permittedClientsBasedOnPurpose"].condition = "";
            result = SimplePolicy.validate(wrongPolicy);
        } catch (e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("invalid_policy");
        }
        expect(result).toBe(false);
    });

    it ("must be able to reject consitions with constructs and functions which are not allowed" , () => {
        expect.assertions(9);

        let wrongPolicy = _.cloneDeep(policy);
        let result = false;
        try {
            wrongPolicy.content.rules["permittedClientsBasedOnPurpose"].condition = "function test(){}";
            result = SimplePolicy.validate(wrongPolicy);
        } catch (e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("invalid_policy");
        }
        expect(result).toBe(false);

        result = false;
        wrongPolicy = _.cloneDeep(policy);
        try {
            wrongPolicy.content.rules["permittedClientsBasedOnPurpose"].condition = "delete(rpts);";
            result = SimplePolicy.validate(wrongPolicy);
        } catch (e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("invalid_policy");
        }
        expect(result).toBe(false);

        result = false;
        wrongPolicy = _.cloneDeep(policy);
        try {
            wrongPolicy.content.rules["permittedClientsBasedOnPurpose"].condition = "rpts.test; test";
            result = SimplePolicy.validate(wrongPolicy);
        } catch (e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("invalid_policy");
        }
        expect(result).toBe(false);
    });

    it ("must be able to accept valid policies" , () => {
        expect(SimplePolicy.validate(policy)).toBe(true);;
    });

    it("must allow a whitelisted clientId", () => {
        const claims = {
            client_id: "client1"
        };
        const decision = SimplePolicyEngine.evaluate(claims, policy);
        expect(decision).toHaveProperty("authorization");
        expect(decision.authorization).toEqual("Permit");
    });

    it("must deny a blacklisted clientId", () => {
        const claims = {
            client_id: "client2", 
            organization: "org1"
        };
        const decision = SimplePolicyEngine.evaluate(claims, policy);
        expect(decision).toHaveProperty("authorization");
        expect(decision.authorization).toEqual("Deny");
    });

    it("must deny any other clientIds", () => {
        const claims = {
            client_id: "nonexistent_client"
        };
        const decision = SimplePolicyEngine.evaluate(claims, policy);
        expect(decision).toHaveProperty("authorization");
        expect(decision.authorization).toEqual("Deny");
    });

    it("must redirect client without RPT (understand conditions)", () => {
        const claims = {
            client_id: "client3", 
            rpts: []
        };
        const decision = SimplePolicyEngine.evaluate(claims, policy);
        expect(decision).toHaveProperty("authorization");
        expect(decision.authorization).toEqual("Indeterminate");
        expect(decision).toHaveProperty("obligations");
        expect(decision.obligations).toHaveProperty("UMA_REDIRECT");
    });

    it("must redirect client without RPT (understand conditions)", () => {
        const claims = {
            client_id: "client3", 
            rpts: {}
        };
        const decision = SimplePolicyEngine.evaluate(claims, policy);

        expect(decision).toHaveProperty("authorization");
        expect(decision.authorization).toEqual("Indeterminate");
        expect(decision).toHaveProperty("obligations");
        expect(decision.obligations).toHaveProperty("UMA_REDIRECT");
    });

    it("must permit a client with the right RPT (understand conditions)", () => {
        const claims = {
            client_id: "client3",
            rpts: {
                "http://localhost:3001": [
                    {
                        "resource_id": "test_id",
                        "scopes": ["s1"]
                    }
                ]
            }
        };
        const decision = SimplePolicyEngine.evaluate(claims, policy);
        expect(decision).toHaveProperty("authorization");
        expect(decision.authorization).toEqual("Permit");
    });
});

describe("simple policy combiner engine", () => {

    it("must return NotApplicable on empty", () => {
        const claims = {
            client_id: "client1"
        };
        const decision = SimplePolicyDecisionCombinerEngine.evaluate(claims, [], {});
        expect(decision).toHaveProperty("authorization");
        expect(decision.authorization).toEqual("NotApplicable");
    });

    it("must return Deny on Permit, Indeterminate, and Deny and combine obligations", () => {
        const permittingPolicy = _.cloneDeep(policy);
        const denyingPolicy = _.cloneDeep(policy);
        denyingPolicy.content.rules.permittedClientsBasedOnClientId.matchAnyOf = [];
        denyingPolicy.content.rules.deniedClients.matchAnyOf = [{client_id: "client1"}];

        const indeterminatePolicy = _.cloneDeep(policy);
        denyingPolicy.content.rules.permittedClientsBasedOnClientId.matchAnyOf = [];

        const claims = {
            client_id: "client1"
        };
        const decision = SimplePolicyDecisionCombinerEngine.evaluate(claims,
                [denyingPolicy, permittingPolicy, indeterminatePolicy],
                policyTypeToEnginesMap);
        expect(decision).toHaveProperty("authorization");
        expect(decision.authorization).toEqual("Deny");
    });
});