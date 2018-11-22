const request = require("supertest");
const nock = require("nock");
const jwt = require("jsonwebtoken");

const Pauldron = require("pauldron");
const PauldronClient = require("pauldron-clients");


const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE || "https://mock-fhir-server/base";
const MOCK_FHIR_SERVER = nock(FHIR_SERVER_BASE);

const POLICY_API_TOKEN = {
    uid: "test_user",
    scopes: ["POL:C", "POL:L", "POL:R", "POL:D"]
};

const AUTH_API_TOKEN = {
    uid: "test_user",
    scopes: ["AUTH:C"]
};

const PROTECTION_API_TOKEN = {
    uid: "test_user",
    scopes: ["INTR:R", "PERMS:C", "PERMS:R", "PERMS:L"]
};

const TEST_POLICY_API_KEY = jwt.sign(POLICY_API_TOKEN, process.env.SECRET_KEY);
const TEST_PROTECTION_API_KEY = jwt.sign(PROTECTION_API_TOKEN, process.env.SECRET_KEY);
const TEST_AUTH_API_KEY = jwt.sign(AUTH_API_TOKEN, process.env.SECRET_KEY);

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

it("happy path with bundle.", async () => {
    expect.assertions(9);
    const bundleRsponse = require("./fixtures/specimen-bundle.json");
    const patient = require("./fixtures/patient.json");

    MOCK_FHIR_SERVER.get("/Patient/1")
        .times(4) //when caching fixed remove this 
        .reply(200, patient); 

    MOCK_FHIR_SERVER.get("/Specimen")
        .times(2)
        .reply(200, bundleRsponse);   

    let res = await request(app)
        .get("/Specimen")
        .set("content-type", "application/json");
    
    const redirectHeader = {
        asymmetricMatch: value => (
            value.includes("UMA realm=") &&
            value.includes("as_uri=") &&
            value.includes("ticket=")
        )
    };
    expect(res.status).toEqual(401);
    expect(res.header).toHaveProperty("www-authenticate");
    expect(res.header["www-authenticate"]).toEqual(redirectHeader);

    const body = JSON.parse(res.text);

    expect(body).toHaveProperty("ticket");
    const ticket = body.ticket;

    expect(body).toHaveProperty("info");
    expect(body.info).toHaveProperty("server");
    expect(body.info.server).toHaveProperty("uri");
    expect(body.info.server).toHaveProperty("authorization_endpoint");
    const authEndpoint = `${body.info.server.uri}${body.info.server.authorization_endpoint}`;

    const rpt = await PauldronClient.RPT.get(
        ticket,
        [{
            format: "jwt",
            token: CLAIMS_TOKEN
        }],
        authEndpoint, 
        TEST_AUTH_API_KEY
    );
    
    res = await request(app)
        .get("/Specimen")
        .set("content-type", "application/json")
        .set("authorization", `Bearer ${rpt}`);
    
    expect(res.body).toMatchObject(bundleRsponse);
});

it("happy path with resource.", async () => {
    expect.assertions(9);
    const bundleRsponse = require("./fixtures/specimen-bundle.json");
    const resourceResponse = bundleRsponse.entry[0].resource;
    const patient = require("./fixtures/patient.json");

    MOCK_FHIR_SERVER.get("/Patient/1")
        .times(4) //when caching fixed remove this 
        .reply(200, patient); 

    MOCK_FHIR_SERVER.get("/Specimen/1")
        .times(2)
        .reply(200, resourceResponse);   

    let res = await request(app)
        .get("/Specimen/1")
        .set("content-type", "application/json");
    
    const redirectHeader = {
        asymmetricMatch: value => (
            value.includes("UMA realm=") &&
            value.includes("as_uri=") &&
            value.includes("ticket=")
        )
    };
    expect(res.status).toEqual(401);
    expect(res.header).toHaveProperty("www-authenticate");
    expect(res.header["www-authenticate"]).toEqual(redirectHeader);

    const body = JSON.parse(res.text);

    expect(body).toHaveProperty("ticket");
    const ticket = body.ticket;

    expect(body).toHaveProperty("info");
    expect(body.info).toHaveProperty("server");
    expect(body.info.server).toHaveProperty("uri");
    expect(body.info.server).toHaveProperty("authorization_endpoint");
    const authEndpoint = `${body.info.server.uri}${body.info.server.authorization_endpoint}`;

    const rpt = await PauldronClient.RPT.get(
        ticket,
        [{
            format: "jwt",
            token: CLAIMS_TOKEN
        }],
        authEndpoint, 
        TEST_AUTH_API_KEY
    );
    
    res = await request(app)
        .get("/Specimen/1")
        .set("content-type", "application/json")
        .set("authorization", `Bearer ${rpt}`);
    
    expect(res.body).toMatchObject(resourceResponse);
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
