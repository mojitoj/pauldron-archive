const request = require("supertest");
const _ = require("lodash");
const jwt = require("jsonwebtoken");
const db = require("../../lib/db");
const ClaimIssuers = require("../../lib/claims-issuers");

const { 
    app,
    PERMISSION_ENDPOINT_URI,
    INTROSPECTION_ENDPOINT_URI,
    AUTHORIZATION_ENDPOINT_URI,
    POLICY_ENDPOINT_URI
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

const ANOTHER_AUTH_API_TOKEN = {
    uid: "test_user",
    realm: "another-example",
    scopes: ["AUTH:C"]
};

const PROTECTION_API_TOKEN = {
    uid: "test_user",
    realm: "example",
    scopes: ["INTR:R", "PERMS:C", "PERMS:R", "PERMS:L"]
};

const TEST_POLICY_API_KEY = jwt.sign(POLICY_API_TOKEN, process.env.SECRET_KEY);
const TEST_PROTECTION_API_KEY = jwt.sign(PROTECTION_API_TOKEN, process.env.SECRET_KEY);
const TEST_AUTH_API_KEY = jwt.sign(AUTH_API_TOKEN, process.env.SECRET_KEY);
const ANOTHER_TEST_AUTH_API_KEY = jwt.sign(ANOTHER_AUTH_API_TOKEN, process.env.SECRET_KEY);

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

it("should issue an RPT based on the policy and correctly introspect it.", async () => {
    expect.assertions(11);
    let res = await request(app)
        .post(PERMISSION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send({resource_set_id: "test_res_id", scopes: ["s1", "s2"]});

    expect(res.status).toEqual(201);
    expect(res.body).toHaveProperty("ticket");
    const ticket = res.body.ticket;

    res = await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            "ticket": ticket,
            "claim_tokens": [
                {
                    format: "jwt",
                    token: CLAIMS_TOKEN
                }
        ]});
    expect(res.status).toEqual(201);
    expect(res.body).toHaveProperty("rpt");
    expect(res.body.rpt).toBeTruthy();

    const rpt = res.body.rpt;

    res = await request(app)
        .post(INTROSPECTION_ENDPOINT_URI)
        .set("content-type", "application/x-www-form-urlencoded")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send({"token": rpt});
    expect(res.body).toHaveProperty("active");
    expect(res.body).toHaveProperty("iat");
    expect(res.body).toHaveProperty("exp");
    expect(res.body).toHaveProperty("permissions");
    expect(res.body.permissions).toHaveLength(1);
    expect(res.body.permissions[0]).toMatchObject({resource_set_id: "test_res_id", scopes: ["s2"]});
});

it("should NOT issue an RPT if the ticket was issued based on another server's permission reg request", async () => {
    expect.assertions(5);
    let res = await request(app)
        .post(PERMISSION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send({resource_set_id: "test_res_id", scopes: ["s1", "s2"]});

    expect(res.status).toEqual(201);
    expect(res.body).toHaveProperty("ticket");
    const ticket = res.body.ticket;

    res = await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${ANOTHER_TEST_AUTH_API_KEY}`)
        .send({
            "ticket": ticket,
            "claim_tokens": [
                {
                    format: "jwt",
                    token: CLAIMS_TOKEN
                }
        ]});
    expect(res.status).toEqual(403);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toEqual("invalid_ticket");
});

it("should reject a blacklisted client", async () => {
    expect.assertions(3);
    const permissions = [{resource_set_id: "test_res_id", scopes: ["s1", "s2"]}];
    let res = await request(app)
        .post(PERMISSION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send(permissions);
    const ticket = res.body.ticket;
    let newClaims = _.cloneDeep(CLAIMS);
    newClaims["client_id"] = "client2";
    const claimsToken = jwt.sign(newClaims, "secret1");

    res =  await request(app)
            .post(AUTHORIZATION_ENDPOINT_URI)
            .set("content-type", "application/json")
            .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
            .send({ticket: ticket, claim_tokens: [{
                format: "jwt",
                token: claimsToken
            }]});
    expect(res.status).toEqual(403);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toEqual("policy_forbidden");
});
