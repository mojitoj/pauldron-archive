const request = require("supertest");
const _ = require("lodash");
const jwt = require("jsonwebtoken");
const db = require("../../lib/db");

const { 
    app,
    INTROSPECTION_ENDPOINT_URI
} = require("../../app");

const PROTECTION_API_TOKEN = {
    uid: "test_user",
    scopes: ["INTR:R", "PERMS:C", "PERMS:R", "PERMS:L"]
};

const TEST_PROTECTION_API_KEY = jwt.sign(PROTECTION_API_TOKEN, process.env.SECRET_KEY);

beforeEach(async () => {
    await db.flush();
});

afterAll(async () => {
    await db.flush();
});

it("should fail introspection if the rpt is invalid", async () => {
    expect.assertions(3);

    res = await request(app)
        .post(INTROSPECTION_ENDPOINT_URI)
        .set("content-type", "application/x-www-form-urlencoded")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send({"token": "non-existent-rpt"});
    expect(res.status).toEqual(200);
    expect(res.body).toHaveProperty("active");
    expect(res.body.active).toBe(false);
});

it("should return 400 if no rpt is given", async () => {
    expect.assertions(1);

    res = await request(app)
        .post(INTROSPECTION_ENDPOINT_URI)
        .set("content-type", "application/x-www-form-urlencoded")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send({});
    expect(res.status).toEqual(400);
});
