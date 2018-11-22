const request = require("supertest");
const nock = require("nock");

const {app} = require("../app");

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE || "https://mock-fhir-server/base";
const MOCK_FHIR_SERVER = nock(FHIR_SERVER_BASE);

beforeEach(async () => {
});

afterAll(async () => {
});

it("should return a bundle of unprotected resources as-is", async () => {
    expect.assertions(2);
    const bundleRsponse = require("./fixtures/consent-bundle.json");
    MOCK_FHIR_SERVER
        .get("/Consent")
        .reply(200, bundleRsponse);

    let res = await request(app)
        .get("/Consent")
        .set("content-type", "application/json");
    
    expect(res.status).toEqual(200);
    expect(res.body).toEqual(bundleRsponse);
});

it("should return an unprotected resources as-is", async () => {
    expect.assertions(2);
    const resourceResponse = require("./fixtures/patient.json");
    MOCK_FHIR_SERVER
        .get("/Patient/1")
        .reply(200, resourceResponse);

    let res = await request(app)
        .get("/Patient/1")
        .set("content-type", "application/json");
    
    expect(res.status).toEqual(200);
    expect(res.body).toEqual(resourceResponse);
});

it("should return a 404 if the resources does not exists", async () => {
    expect.assertions(1);
    MOCK_FHIR_SERVER
        .get("/Patient/2")
        .reply(404);

    let res = await request(app)
        .get("/Patient/2")
        .set("content-type", "application/json");
    
    expect(res.status).toEqual(404);
});
