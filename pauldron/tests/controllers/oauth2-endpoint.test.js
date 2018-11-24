const request = require("supertest");
const _ = require("lodash");
const jwt = require("jsonwebtoken");
const db = require("../../lib/db");

const { 
    app,
    OAUTH2_AUTHORIZATION_ENDPOINT_URI
} = require("../../app");

const AUTH_API_TOKEN = {
    uid: "test_user",
    scopes: ["AUTH:C"]
};

const TEST_AUTH_API_KEY = jwt.sign(AUTH_API_TOKEN, process.env.SECRET_KEY);

beforeEach(async () => {
    await db.flush();
});

afterAll(async () => {
    await db.flush();
});

it("should return 400 if parameters are missing", async () => {
    expect.assertions(1);

    const res = await request(app)
        .post(OAUTH2_AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/x-www-form-urlencoded")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({});
    expect(res.status).toEqual(400);
});

it("should return 400 if parameters are malformed or not supported", async () => {
    expect.assertions(2);

    let res = await request(app)
        .post(OAUTH2_AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/x-www-form-urlencoded")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            grant_type: "client_credentials",
            client_assertion_type: "unsupported_assertion_type",
            client_assertion: "things",
            scope: "things"
        });
    expect(res.status).toEqual(400);

    res = await request(app)
        .post(OAUTH2_AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/x-www-form-urlencoded")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            grant_type: "unsupported_grant_type",
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            client_assertion: "things",
            scope: "things"
        });
    expect(res.status).toEqual(400);
});

it("should return 403 if presented claims are malformed", async () => {
    expect.assertions(1);

    res = await request(app)
        .post(OAUTH2_AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/x-www-form-urlencoded")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            grant_type: "client_credentials",
            client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            client_assertion: "things",
            scope: "things"
        });
    expect(res.status).toEqual(403);
});
