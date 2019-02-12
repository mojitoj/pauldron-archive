const _ = require("lodash");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const nock = require("nock");

const db = require("../../lib/db");

const ClaimIssuers = require("../../lib/claims-issuers");
const UpstreamServers = require("../../lib/upstream-servers");


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

const PROTECTION_API_TOKEN = {
    uid: "test_user",
    realm: "example",
    scopes: ["INTR:R", "PERMS:C", "PERMS:R", "PERMS:L"]
};

const TEST_POLICY_API_KEY = jwt.sign(POLICY_API_TOKEN, process.env.SECRET_KEY);
const TEST_PROTECTION_API_KEY = jwt.sign(PROTECTION_API_TOKEN, process.env.SECRET_KEY);
const TEST_AUTH_API_KEY = jwt.sign(AUTH_API_TOKEN, process.env.SECRET_KEY);

const POLICY = require("../fixtures/simple-policy.json");

const CLAIMS = {
    client_id: "client3",
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



const UPSTREAM_SERVER_ID = "https://upstream-uma-server";
const UPSTREAM_PROTECTION_API_TOKEN = UpstreamServers.protectionAPITokenFor(UPSTREAM_SERVER_ID);

const UPSTREAM_SERVER = nock(
    UPSTREAM_SERVER_ID, 
    {
        reqheaders: {
            "Authorization": 
                (headerValue) => (headerValue === `Bearer ${UPSTREAM_PROTECTION_API_TOKEN}`)
        }
    }
);


const otherAssertions = {
    rpts: {
            "https://upstream-uma-server/": [{resource_set_id: "test_res_id", scopes: ["s1", "s2"]}]
        }
};
const PERMISSIONS = [
    {
        resource_set_id: "test_res_id", 
        scopes: ["s1", "s2"]
    }
];

beforeAll(async () => {
    UPSTREAM_SERVER.post("/protection/permissions")
        .reply(201, {ticket: "sample_ticket"});

    const now = new Date().valueOf();
    
    UPSTREAM_SERVER.post("/protection/introspection")
        .reply(200, 
            {
                active: true,
                iat: now,
                exp: now + 5 * 1000,
                permissions: [{resource_set_id: "test_res_id", scopes: ["s2"]}]
            }
        );
    
});

beforeEach(async () => {
    await db.flush();
});

afterAll(async () => {
    await db.flush();
});

it("should return a 403 if the policy require RPT from an unknown server.", async () => {
    expect.assertions(3);

    const policy = _.cloneDeep(POLICY);
    policy.content.rules
        .upstreamClientsWithoutRPT
        .decision
        .obligations
        .UMA_REDIRECT
        .uri = "http://unknown-upstream-uma-server";

    policy.content.rules
        .upstreamClientsWithoutRPT
        .condition= "!rpts.hasOwnProperty('http://unknown-upstream-uma-server')";

    await request(app)
        .post(POLICY_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_POLICY_API_KEY}`)
        .send(policy);

    let res = await request(app)
        .post(PERMISSION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send(PERMISSIONS);
    const ticket = res.body.ticket;

    res =  await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({"ticket": ticket, "claim_tokens": [{
            format: "jwt",
            token: CLAIMS_TOKEN
        }]});
    
    expect(res.status).toEqual(403);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toEqual("need_info");
});

it("should return 403 if the rpt token provided does not carry upstream server info", async() => {
    expect.assertions(3);

    res = await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            "ticket": "test-ticket",
            "claim_tokens": [{
                format: "jwt",
                token: CLAIMS_TOKEN
            },
            {
                format: "rpt",
                token: "test-token",
            }]
        });
    expect(res.status).toEqual(403);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toEqual("need_info");
});

it("should return 403 if the rpt token provided cannot be introspected", async() => {
    expect.assertions(3);

    res = await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            "ticket": "test-ticket",
            "claim_tokens": [{
                format: "jwt",
                token: CLAIMS_TOKEN
            },
            {
                format: "rpt",
                token: "test-token",
                info: {
                    uri: "https://some-invalid-endpoint",
                    introspection_endpoint: "/introspection"
                }
            }]
        });
    expect(res.status).toEqual(403);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toEqual("not_authorized");
});


it("happy path: should be able to get an RPT for an authorized client after redirecting to upstream UMA.", async () => {
    expect.assertions(19);

    await request(app)
        .post(POLICY_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_POLICY_API_KEY}`)
        .send(POLICY);

    let res = await request(app)
        .post(PERMISSION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_PROTECTION_API_KEY}`)
        .send(PERMISSIONS);
    expect(res.status).toEqual(201);
    expect(res.body).toHaveProperty("ticket");
    const ticket = res.body.ticket;

    res =  await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({"ticket": ticket, "claim_tokens": [{
            format: "jwt",
            token: CLAIMS_TOKEN
        }]});
    
    expect(res.status).toEqual(401);
    expect(res.headers).toHaveProperty("www-authenticate");
    expect(res.body).toHaveProperty("error");
    expect(res.body).toHaveProperty("info");
    expect(res.body.info).toHaveProperty("server");
    expect(res.body.error).toEqual("uma_redirect");

    const ticketOpeningTag = "ticket=\"";
    const ticketStartIndex = res.headers["www-authenticate"].indexOf(ticketOpeningTag) + ticketOpeningTag.length;
    const secondTicket = res.headers["www-authenticate"].substring(ticketStartIndex, res.headers["www-authenticate"].indexOf("\"", ticketStartIndex));
    expect(secondTicket).toBeTruthy();

    const upstreamServerInfo = res.body.info.server;


    const testUpstreamRpt = "test_upstream_rpt";


    res = await request(app)
        .post(AUTHORIZATION_ENDPOINT_URI)
        .set("content-type", "application/json")
        .set("Authorization", `Bearer ${TEST_AUTH_API_KEY}`)
        .send({
            "ticket": ticket,
            "claim_tokens": [{
                format: "jwt",
                token: CLAIMS_TOKEN
            },
            {
                format: "rpt",
                token: testUpstreamRpt,
                info: upstreamServerInfo

            }]
        });
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
    expect(res.body.permissions).toHaveLength(2);
    expect(res.body.permissions[0]).toMatchObject({resource_set_id: "test_res_id", scopes: ["s1", "s2"]});
    expect(res.body.permissions[1]).toMatchObject({deny: true, resource_set_id: "test_res_id", scopes: ["s1"]});
});
