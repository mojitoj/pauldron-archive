const request = require("supertest");
const _ = require("lodash");
const jwt = require("jsonwebtoken");
const db = require("../../lib/db");

const { 
    app,
    POLICY_ENDPOINT_URI
} = require("../../app");

const POLICY_API_TOKEN = {
    uid: "test_user",
    realm: "example",
    scopes: ["POL:C", "POL:L", "POL:R", "POL:D"]
};
const TEST_POLICY_API_KEY = jwt.sign(POLICY_API_TOKEN, process.env.SECRET_KEY);
const policy = require("../fixtures/simple-policy.json");

beforeEach(async () => {
    await db.flush();
});

afterAll(async () => {
    await db.flush();
});

it("should accept a new policy", async () => {
    expect.assertions(6);
    let res = await request(app)
        .post(POLICY_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_POLICY_API_KEY}`)
        .send(policy);

    expect(res.status).toEqual(201);
    expect(res.body).toHaveProperty("id");
    const policyId = res.body.id;

    res = await request(app)
        .get(POLICY_ENDPOINT_URI)
        .set("Authorization", `Bearer ${TEST_POLICY_API_KEY}`);

    expect(res.status).toEqual(200);
    expect(res.body).toMatchObject([{id: policyId, ... policy}]);

    res = await request(app)
        .get(POLICY_ENDPOINT_URI + "/" + policyId)
        .set("Authorization", `Bearer ${TEST_POLICY_API_KEY}`);

    expect(res.status).toEqual(200);
    expect(res.body).toMatchObject({id: policyId, ... policy});
});

it("should reject a malformed policy", async () => {
    expect.assertions(1);
    const wrongPolicy = _.cloneDeep(policy);
    wrongPolicy.content.rules["permittedClientsBasedOnPurpose"].condition = "delete(rpts);";
    const res = await request(app)
            .post(POLICY_ENDPOINT_URI)
            .set("content-type", "application/json")
            .set("Authorization", `Bearer ${TEST_POLICY_API_KEY}`)
            .send(wrongPolicy);
    expect(res.status).toEqual(400);
});

it("should be able to delete a policy by Id", async () => {
    expect.assertions(2);

    let res = await request(app)
        .post(POLICY_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_POLICY_API_KEY}`)
        .send(policy);

    const policyId = res.body.id;

    res = await request(app)
        .del(`${POLICY_ENDPOINT_URI}/${policyId}`)
        .set("Authorization", `Bearer ${TEST_POLICY_API_KEY}`);
    expect(res.status).toEqual(204);

    res = await request(app)
        .get(`${POLICY_ENDPOINT_URI}/${policyId}`)
        .set("Authorization", `Bearer ${TEST_POLICY_API_KEY}`);

    expect(res.status).toEqual(404);
});
