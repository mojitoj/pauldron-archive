const request = require("supertest");
const nock = require("nock");
const jwt = require("jsonwebtoken");

const Pauldron = require("pauldron");
const PauldronClient = require("pauldron-clients");


const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE || "https://mock-fhir-server/base";
const MOCK_FHIR_SERVER = nock(FHIR_SERVER_BASE)
                        .defaultReplyHeaders({"Content-Type": "application/json; charset=utf-8"})
                        .replyContentLength();

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

process.env.UMA_MODE = "false";
process.env.UMA_SERVER_PROTECTION_API_KEY = TEST_PROTECTION_API_KEY;
const {app} = require("../app");

const POLICY = require("./fixtures/simple-policy.json");

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

const CLAIMS_TOKEN = jwt.sign(CLAIMS, Pauldron.ClaimIssuers.keyOf("sampleIssuer1"));

var umaServer;
const UMA_PORT = parseInt(process.env.UMA_SERVER_PORT || "3000");
const UMA_SERVER_BASE = `http://localhost:${UMA_PORT}`;

beforeAll(async() => {
    umaServer = Pauldron.app.listen(UMA_PORT);
});

beforeEach(async () => {
    await Pauldron.db.flush();
    await PauldronClient.Policy.add(
        POLICY, 
        `${UMA_SERVER_BASE}${Pauldron.POLICY_ENDPOINT_URI}`, 
        TEST_POLICY_API_KEY
    );
});

afterAll(async () => {
    await Pauldron.db.flush();
    umaServer.close();
});


it("should return a 403 if bundle of protected resources includes references to a patient whom cannot be found.", async () => {
    expect.assertions(1);
    const bundleRsponse = require("./fixtures/specimen-bundle.json");
    MOCK_FHIR_SERVER
        .get("/Specimen")
        .reply(200, bundleRsponse);

    let res = await request(app)
        .get("/Specimen")
        .set("content-type", "application/json");
    
    expect(res.status).toEqual(403);
});

it("happy path with bundle, oauth2.", async () => {
    expect.assertions(4);
    const bundleRsponse = require("./fixtures/specimen-bundle.json");
    const patient = require("./fixtures/patient.json");

    MOCK_FHIR_SERVER.get("/Patient/1")
        .times(4) //when caching fixed remove this 
        .reply(200, patient); 

    MOCK_FHIR_SERVER.get("/Specimen")
        .times(2)
        .reply(200, bundleRsponse);

    const scope = JSON.stringify([
        {
            resource_set_id: {
              patientId: {
                system: "urn:official:id",
                value: "10001"
              },
              resourceType: "Specimen",
              securityLabel: "*"
            },
            scopes: ["read"]
          }
    ]);

    let res = await request(UMA_SERVER_BASE)
        .post("/oauth2/authorization")
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
        .get("/Specimen")
        .set("content-type", "application/json")
        .set("authorization", `Bearer ${token}`);    

    expect(res.body).toMatchObject(bundleRsponse);
});

it("should return 403 if insufficient scopes.", async () => {
    expect.assertions(6);
    const bundleRsponse = require("./fixtures/specimen-bundle.json");
    const patient = require("./fixtures/patient.json");

    MOCK_FHIR_SERVER.get("/Patient/1")
        .times(4) //when caching fixed remove this 
        .reply(200, patient); 

    MOCK_FHIR_SERVER.get("/Specimen")
        .times(2)
        .reply(200, bundleRsponse);

    const scope = JSON.stringify([
        {
            resource_set_id: {
              patientId: {
                system: "urn:official:id",
                value: "10001"
              },
              resourceType: "Specimen"
            },
            scopes: [
              {
                action: "write",
                securityLabel: "*"
              }
            ]
          }
    ]);

    let res = await request(UMA_SERVER_BASE)
        .post("/oauth2/authorization")
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
        .get("/Specimen")
        .set("content-type", "application/json")
        .set("authorization", `Bearer ${token}`);    
    
    expect(res.status).toEqual(403);
    const body = JSON.parse(res.text);
    expect(body).toHaveProperty("error");
    expect(body.error).toEqual("authorization_error");
});


it("Should return 403 if a bad rpt is sent.", async () => {
    expect.assertions(1);
    const bundleRsponse = require("./fixtures/specimen-bundle.json");
    const patient = require("./fixtures/patient.json");

    MOCK_FHIR_SERVER.get("/Patient/1")
        .times(4) //when caching fixed remove this 
        .reply(200, patient); 

    MOCK_FHIR_SERVER.get("/Specimen")
        .times(2)
        .reply(200, bundleRsponse);   

    const rpt = "BAD_RPT";
    
    res = await request(app)
        .get("/Specimen")
        .set("content-type", "application/json")
        .set("authorization", `Bearer ${rpt}`);
        
    expect(res.status).toEqual(403);
});

it("Should return 401 if a no rpt is sent.", async () => {
    expect.assertions(1);
    const bundleRsponse = require("./fixtures/specimen-bundle.json");
    const patient = require("./fixtures/patient.json");

    MOCK_FHIR_SERVER.get("/Patient/1")
        .times(4) //when caching fixed remove this 
        .reply(200, patient); 

    MOCK_FHIR_SERVER.get("/Specimen")
        .times(2)
        .reply(200, bundleRsponse);   
    
    res = await request(app)
        .get("/Specimen")
        .set("content-type", "application/json");
    
    expect(res.status).toEqual(401);
});
