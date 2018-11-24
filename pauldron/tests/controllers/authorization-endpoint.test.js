const request = require("supertest");
const _ = require("lodash");
const jwt = require("jsonwebtoken");
const db = require("../../lib/db");

const { 
    app,
    AUTHORIZATION_ENDPOINT_URI
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

it("should return 400 if no ticket is presented", async () => {
    expect.assertions(1);

    const res = await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({});
    expect(res.status).toEqual(400);
    console.log(JSON.stringify(res.body));
});

it("should return 400 if no claim_tokens is presented", async () => {
    expect.assertions(1);

    const res = await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            ticket: "test_ticket"
        });
    expect(res.status).toEqual(400);
    console.log(JSON.stringify(res.body));
});

it("should return 400 if a malformed claim_tokens is presented", async () => {
    expect.assertions(3);

    let res = await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            ticket: "test_ticket",
            claim_tokens: ""
        });
    expect(res.status).toEqual(400);

    res = await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            ticket: "test_ticket",
            claim_tokens: []
        });
    expect(res.status).toEqual(400);

    res = await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            ticket: "test_ticket",
            claim_tokens: [{}]
        });
    expect(res.status).toEqual(400);
});
