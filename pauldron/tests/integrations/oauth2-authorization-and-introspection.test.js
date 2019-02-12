const request = require("supertest");
const _ = require("lodash");
const jwt = require("jsonwebtoken");

const db = require("../../lib/db");
const ClaimIssuers = require("../../lib/claims-issuers");

const {
    INTROSPECTION_ENDPOINT_URI,
    POLICY_ENDPOINT_URI,
    OAUTH2_AUTHORIZATION_ENDPOINT_URI,
    app
} = require("../../app");

const POLICY_API_TOKEN = {
    uid: "test_user",
    realm: "example",
    scopes: ["POL:C", "POL:L", "POL:R", "POL:D"]
};

const AUTH_API_TOKEN = {
    uid: "test_user",
    realm: "example",
    scopes: ["AUTH:C"]
};

const PROTECTION_API_TOKEN = {
    uid: "test_user",
    realm: "example",
    scopes: ["INTR:R"]
};

const ANOTHER_PROTECTION_API_TOKEN = {
    uid: "test_user",
    realm: "another-example",
    scopes: ["INTR:R"]
};

const TEST_POLICY_API_KEY = jwt.sign(POLICY_API_TOKEN, process.env.SECRET_KEY);
const TEST_PROTECTION_API_KEY = jwt.sign(PROTECTION_API_TOKEN, process.env.SECRET_KEY);
const ANOTHER_TEST_PROTECTION_API_KEY = jwt.sign(ANOTHER_PROTECTION_API_TOKEN, process.env.SECRET_KEY);
const TEST_AUTH_API_KEY = jwt.sign(AUTH_API_TOKEN, process.env.SECRET_KEY);

const policy = require("../fixtures/simple-policy.json");

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

beforeEach(async () => {
    await db.flush();
    await request(app)
        .post(POLICY_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_POLICY_API_KEY}`)
        .send(policy);
});

afterAll(async () => {
    await db.flush();
});

it("should issue a oauth2 token based on the policy and correctly introspect it.", async () => {
    expect.assertions(10);

    const scope = JSON.stringify([{resource_set_id: "test_res_id", scopes: ["s1", "s2"]}]);

    let res = await request(app)
        .post(OAUTH2_AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/x-www-form-urlencoded")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            grant_type: "client_credentials",
            client_assertion: CLAIMS_TOKEN,
            scope
        });

    expect(res.status).toEqual(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.token).toBeTruthy();

    const token = res.body.token;

    res = await request(app)
        .post(INTROSPECTION_ENDPOINT_URI)
        .set("content-type", "application/x-www-form-urlencoded")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send({"token": token});
    expect(res.body).toHaveProperty("active");
    expect(res.body).toHaveProperty("iat");
    expect(res.body).toHaveProperty("exp");
    expect(res.body).toHaveProperty("permissions");
    expect(res.body.permissions).toHaveLength(2);
    expect(res.body.permissions[0]).toMatchObject({resource_set_id: "test_res_id", scopes: ["s1", "s2"]});
    expect(res.body.permissions[1]).toMatchObject({deny: true, resource_set_id: "test_res_id", scopes: ["s1"]});
});

it("should NOT introspect a token if the token was issued based on another server's ", async () => {
    expect.assertions(5);

    const scope = JSON.stringify([{resource_set_id: "test_res_id", scopes: ["s1", "s2"]}]);

    let res = await request(app)
        .post(OAUTH2_AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/x-www-form-urlencoded")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            grant_type: "client_credentials",
            client_assertion: CLAIMS_TOKEN,
            scope
        });

    expect(res.status).toEqual(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.token).toBeTruthy();

    const token = res.body.token;

    res = await request(app)
        .post(INTROSPECTION_ENDPOINT_URI)
        .set("content-type", "application/x-www-form-urlencoded")
        .set("Authorization", `Bearer ${ANOTHER_TEST_PROTECTION_API_KEY}`)
        .send({"token": token});
    expect(res.body).toHaveProperty("active");
    expect(res.body.active).toBeFalsy();
});

it("should reject a blacklisted client", async () => {
    expect.assertions(3);

    const scope = JSON.stringify([{resource_set_id: "test_res_id", scopes: ["s1", "s2"]}]);
    
    let newClaims = _.cloneDeep(CLAIMS);
    newClaims["client_id"] = "client2";
    const claimsToken = jwt.sign(newClaims, "secret1");

    res =  await request(app)
            .post(OAUTH2_AUTHORIZATION_ENDPOINT_URI)
            .set("content-type", "application/x-www-form-urlencoded")
            .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
            .send({
                client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                grant_type: "client_credentials",
                client_assertion: claimsToken,
                scope
            });
    expect(res.status).toEqual(403);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toEqual("policy_forbidden");
});
