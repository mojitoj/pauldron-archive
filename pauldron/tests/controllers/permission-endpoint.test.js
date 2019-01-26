
const request = require("supertest");
const _ = require("lodash");
const jwt = require("jsonwebtoken");

const db = require("../../lib/db");

const { 
    app,
    PERMISSION_ENDPOINT_URI
} = require("../../app");

const PROTECTION_API_TOKEN = {
    uid: "test_user",
    realm: "example",
    scopes: ["INTR:R", "PERMS:C", "PERMS:R", "PERMS:L"]
};

const ANOTHER_REALM_PROTECTION_API_TOKEN = {
    uid: "test_user",
    realm: "another-example",
    scopes: ["INTR:R", "PERMS:C", "PERMS:R", "PERMS:L"]
};

const TEST_PROTECTION_API_KEY = jwt.sign(PROTECTION_API_TOKEN, process.env.SECRET_KEY);
const ANOTHER_REALM_PROTECTION_API_KEY = jwt.sign(ANOTHER_REALM_PROTECTION_API_TOKEN, process.env.SECRET_KEY);

beforeEach(async () => {
    await db.flush();
});

afterAll(async () => {
    await db.flush();
});

it("should return an empty object if no permissions has been registered ", async () => {
    expect.assertions(2);
    const res = await request(app)
        .get(PERMISSION_ENDPOINT_URI)
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`);
    expect(res.status).toEqual(200);
    expect(res.body).toMatchObject({});
});

it("should return a 401 if called with no API token ", async () => {
    expect.assertions(1);
    const res = await request(app)
        .get(PERMISSION_ENDPOINT_URI)
    expect(res.status).toEqual(401);
});

it("should return a 403 if called with a bad API token ", async () => {
    expect.assertions(1);
    const res = await request(app)
        .get(PERMISSION_ENDPOINT_URI)
        .set("Authorization", `Bearer BADTOKEN`);
    expect(res.status).toEqual(403);
});

it("should return a 403 if called with an API token with insufficient scopes", async () => {
    expect.assertions(1);
    const INSUFFICIENT_PROTECTION_API_TOKEN = {
        uid: "test_user",
        scopes: ["INTR:R", "PERMS:C", "PERMS:R"]
    };
    const INSUFFICIENT_PROTECTION_API_KEY = jwt.sign(INSUFFICIENT_PROTECTION_API_TOKEN, process.env.SECRET_KEY);

    const res = await request(app)
        .get(PERMISSION_ENDPOINT_URI)
        .set("Authorization", `Bearer ${INSUFFICIENT_PROTECTION_API_KEY}`);
    expect(res.status).toEqual(403);
});

it("should be able to create a ticket from a permission(list) only with the right realm", async () => {
    expect.assertions(7);
    
    let res = await request(app)
        .post(PERMISSION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send({resource_set_id: "test_res_id", scopes: ["s1", "s2"]});
    
    expect(res.status).toEqual(201);
    expect(res.body).toHaveProperty("ticket");

    const ticket = res.body.ticket;

    res = await request(app)
        .get(PERMISSION_ENDPOINT_URI)
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`);
    
    expect(res.status).toEqual(200);
    
    const permissions = res.body;

    expect(permissions).toHaveLength(1);
    expect(permissions[0].id).toEqual(ticket);

    res = await request(app)
        .get(PERMISSION_ENDPOINT_URI)
        .set("Authorization", `Bearer ${ANOTHER_REALM_PROTECTION_API_KEY}`);
    
    expect(res.status).toEqual(200);
    expect(res.body).toHaveLength(0);
});

it("should be able to create a ticket from a permission array", async () => {
    expect.assertions(2);
    const res = await request(app)
        .post(PERMISSION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send([{resource_set_id: "test_res_id", scopes: ["s1", "s2"]}]);
    expect(res.status).toEqual(201);
    expect(res.body).toHaveProperty("ticket");
});

it("should reject malformed requests", async () => {
    expect.assertions(8);

    res = await request(app)
        .post(PERMISSION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send([]);
    expect(res.status).toEqual(400);
    expect(res.body.error).toEqual("bad_request");

    res =  await request(app)
        .post(PERMISSION_ENDPOINT_URI)
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .set("content-type", "application/json")
        .send([{}]);
    expect(res.status).toEqual(400);
    expect(res.body.error).toEqual("bad_request");

    res =  await request(app)
        .post(PERMISSION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send({resource_set_id: "test_res_id", scopes: "ScopeA"});

    expect(res.status).toEqual(400);
    expect(res.body.error).toEqual("bad_request");

    res =  await request(app)
        .post(PERMISSION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send([{resource_set_id: "test_res_id", scopes: "s1"}]);

    expect(res.status).toEqual(400);
    expect(res.body.error).toEqual("bad_request");
});
