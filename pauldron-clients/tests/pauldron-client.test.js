const jwt = require("jsonwebtoken");
const nock = require("nock");

const { 
    app,
    db,
    ClaimIssuers,
    PERMISSION_ENDPOINT_URI,
    INTROSPECTION_ENDPOINT_URI,
    AUTHORIZATION_ENDPOINT_URI,
    POLICY_ENDPOINT_URI
} = require("pauldron");

const POLICY_API_TOKEN = {
    uid: "test_user",
    scopes: ["POL:C", "POL:L", "POL:R", "POL:D"]
};

const AUTH_API_TOKEN = {
    uid: "test_user",
    scopes: ["AUTH:C"]
};

const ANOTHER_AUTH_API_TOKEN = {
    uid: "another_test_user",
    scopes: ["AUTH:C"]
};

const PROTECTION_API_TOKEN = {
    uid: "test_user",
    scopes: ["INTR:R", "PERMS:C", "PERMS:R", "PERMS:L"]
};

const TEST_POLICY_API_KEY = jwt.sign(POLICY_API_TOKEN, process.env.SECRET_KEY);
const TEST_PROTECTION_API_KEY = jwt.sign(PROTECTION_API_TOKEN, process.env.SECRET_KEY);
const TEST_AUTH_API_KEY = jwt.sign(AUTH_API_TOKEN, process.env.SECRET_KEY);
const ANOTHER_TEST_AUTH_API_KEY = jwt.sign(ANOTHER_AUTH_API_TOKEN, process.env.SECRET_KEY);

const POLICY = require("./fixtures/simple-policy.json");

const PauldronClient = require("../PauldronClient");

const CLAIMS = {
    client_id: "client4",
    organization: "org1",
    iss: "sampleIssuer1",
    pous: [
        {
            system: "http://hl7.org/fhir/v3/ActReason",
            code: "TREAT"
        }
    ]
};

const CLAIMS_TOKEN = jwt.sign(CLAIMS, ClaimIssuers.keyOf("sampleIssuer1"));

var server;
const PORT = parseInt(process.env.PORT || "3000");
const SERVER_BASE = `http://localhost:${PORT}`;



beforeAll(async() => {
    server = app.listen(PORT);
});

beforeEach(async () => {
    await db.flush();
});

afterAll(async () => {
    await db.flush();
    server.close();
});

describe("permission, rpt, introspection", () => {
    it("happy path without cascaded referral.", async () => {
        expect.assertions(3);

        await PauldronClient.Policy.add(
            POLICY, 
            `${SERVER_BASE}${POLICY_ENDPOINT_URI}`, 
            TEST_POLICY_API_KEY
        );

        const permissions = [{resource_set_id: "test_res_id", scopes: ["s1", "s2"]}];

        const ticket = await PauldronClient.Permissions.register(
            permissions,
            `${SERVER_BASE}${PERMISSION_ENDPOINT_URI}`, 
            TEST_PROTECTION_API_KEY
        );
        expect(ticket).toBeTruthy();

        const rpt = await PauldronClient.RPT.get(
            ticket,
            [{
                format: "jwt",
                token: CLAIMS_TOKEN
            }],
            `${SERVER_BASE}${AUTHORIZATION_ENDPOINT_URI}`, 
            TEST_AUTH_API_KEY
        );
        expect(rpt).toBeTruthy();

        const grantedPermissions = await PauldronClient.RPT.introspect(
            rpt,
            `${SERVER_BASE}${INTROSPECTION_ENDPOINT_URI}`, 
            TEST_PROTECTION_API_KEY
        );
        expect(grantedPermissions).toEqual([{"resource_set_id":"test_res_id","scopes":["s2"]}]);
    });
});

describe("error cases", () => {
    const MOCK_SERVER_BASE = "http://mock-server";
    const MOCK_SERVER = nock(MOCK_SERVER_BASE);

    it ("permissions registration ", async () => {
        expect.assertions(2);

        MOCK_SERVER.post(PERMISSION_ENDPOINT_URI).reply(400, {error: "bad things happened"});
        try {
            await PauldronClient.Permissions.register(
                [{resource_set_id: "test_res_id", scopes: ["s1", "s2"]}],
                `${MOCK_SERVER_BASE}${PERMISSION_ENDPOINT_URI}`, 
                TEST_PROTECTION_API_KEY
            );
        } catch (e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("permission_registration_error");
        }
    });

    it ("get rpt", async () => {
        expect.assertions(2);

        MOCK_SERVER.post(AUTHORIZATION_ENDPOINT_URI).reply(400, {error: "bad things happened"});
        try {
            await PauldronClient.RPT.get(
                "test-ticket",
                [{
                    format: "jwt",
                    token: CLAIMS_TOKEN
                }],
                `${MOCK_SERVER_BASE}${AUTHORIZATION_ENDPOINT_URI}`, 
                TEST_AUTH_API_KEY
            );
        } catch (e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("get_rpt_error");
        }
    });

    it ("introspect rpt", async () => {
        expect.assertions(2);

        MOCK_SERVER.post(INTROSPECTION_ENDPOINT_URI).reply(400, {error: "bad things happened"});
        try {
            await PauldronClient.RPT.introspect(
                "test-rpt",
                `${MOCK_SERVER_BASE}${INTROSPECTION_ENDPOINT_URI}`, 
                TEST_PROTECTION_API_KEY
            );
        } catch (e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("introspection_error");
        }
    });

    it ("invalid rpt", async () => {
        expect.assertions(2);

        MOCK_SERVER.post(INTROSPECTION_ENDPOINT_URI).reply(200, {active: false});
        try {
            await PauldronClient.RPT.introspect(
                "test-rpt",
                `${MOCK_SERVER_BASE}${INTROSPECTION_ENDPOINT_URI}`, 
                TEST_PROTECTION_API_KEY
            );
        } catch (e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("invalid_rpt");
        }
    });

});

describe("policy", () => {
    it("auth error.", async () => {
        try {
            await PauldronClient.Policy.add(
                POLICY, 
                `${SERVER_BASE}${POLICY_ENDPOINT_URI}`, 
                `bad key`
            );
        } catch(e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("authorization_error");
        }
    });

    it("successful post, get, delete, not found get.", async () => {
        expect.assertions(4);
        const policyId = await PauldronClient.Policy.add(
            POLICY, 
            `${SERVER_BASE}${POLICY_ENDPOINT_URI}`, 
            TEST_POLICY_API_KEY
        );
        expect(policyId).toBeTruthy();

        const policy = await PauldronClient.Policy.get(
            policyId,
            `${SERVER_BASE}${POLICY_ENDPOINT_URI}`, 
            TEST_POLICY_API_KEY
        );
        expect(policy).toMatchObject(
            {
                ...POLICY, 
                id: policyId
            }
        );
        
        await PauldronClient.Policy.delete(
            policyId,
            `${SERVER_BASE}${POLICY_ENDPOINT_URI}`, 
            TEST_POLICY_API_KEY
        );
        try {
            await PauldronClient.Policy.get(
                policyId,
                `${SERVER_BASE}${POLICY_ENDPOINT_URI}`, 
                TEST_POLICY_API_KEY
            );
        } catch(e) {
            expect(e).toHaveProperty("error");
            expect(e.error).toEqual("object_not_found");
        }
    });
});