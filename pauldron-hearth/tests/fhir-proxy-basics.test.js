const zlib = require("zlib");
const request = require("supertest");
const nock = require("nock");
const _ = require("lodash");

const VocabularyUtils = require("../lib/VocabularyUtils");

const { app } = require("../app");

const FHIR_SERVER_BASE =
  process.env.FHIR_SERVER_BASE || "https://mock-fhir-server/base";
const MOCK_FHIR_SERVER = nock(FHIR_SERVER_BASE)
  .defaultReplyHeaders({ "Content-Type": "application/json; charset=utf-8" })
  .replyContentLength();

beforeEach(async () => {});

afterEach(() => {
  nock.cleanAll();
});

it("should return a bundle of unprotected resources as-is", async () => {
  expect.assertions(2);
  const bundleRsponse = require("./fixtures/consent-bundle.json");
  MOCK_FHIR_SERVER.get("/Consent").reply(200, bundleRsponse);

  const res = await request(app)
    .get("/Consent")
    .set("content-type", "application/json");

  expect(res.status).toEqual(200);
  expect(res.body).toEqual(bundleRsponse);
});

it("should label resources in a bundle with default confidentiality label and add confidentiality hwm to the bundle", async () => {
  expect.assertions(4);
  const bundleRsponse = require("./fixtures/consent-bundl-with-labeled-resource.json");
  MOCK_FHIR_SERVER.get("/Consent").reply(200, bundleRsponse);

  const res = await request(app)
    .get("/Consent")
    .set("content-type", "application/json");

  expect(res.status).toEqual(200);
  expect(res.body.entry[0].resource.meta.security).toEqual(
    expect.arrayContaining([
      {
        system: VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM,
        code: VocabularyUtils.DEFAULT_CONFIDENTIALITY_CODE
      }
    ])
  );
  expect(res.body.entry[1].resource.meta.security).toBeUndefined();
  expect(res.body.meta.security).toEqual(
    expect.arrayContaining([
      {
        system: VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM,
        code: VocabularyUtils.DEFAULT_CONFIDENTIALITY_CODE
      }
    ])
  );
});

it("should return an unprotected resources as-is", async () => {
  expect.assertions(2);
  const resourceResponse = require("./fixtures/patient.json");
  MOCK_FHIR_SERVER.get("/Patient/1").reply(200, resourceResponse);

  const res = await request(app)
    .get("/Patient/1")
    .set("content-type", "application/json");

  expect(res.status).toEqual(200);
  expect(res.body).toEqual(resourceResponse);
});

it("should label resources and add default label", async () => {
  expect.assertions(2);

  const resourceResponse = require("./fixtures/patient-labeled.json");

  MOCK_FHIR_SERVER.get("/Patient/2").reply(200, resourceResponse);

  const res = await request(app)
    .get("/Patient/2")
    .set("content-type", "application/json");

  expect(res.status).toEqual(200);
  expect(res.body.meta.security).toEqual(
    expect.arrayContaining([
      {
        system: VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM,
        code: VocabularyUtils.DEFAULT_CONFIDENTIALITY_CODE
      }
    ])
  );
});

it("should be able to handle and parse gzip-encoded response from the backend", async () => {
  expect.assertions(2);
  const bundleRsponse = require("./fixtures/consent-bundle.json");
  const gzippedResponse = zlib.gzipSync(
    Buffer.from(JSON.stringify(bundleRsponse), "utf8")
  );
  MOCK_FHIR_SERVER.get("/Consent").reply(200, gzippedResponse, {
    "Content-Encoding": "gzip"
  });

  const res = await request(app)
    .get("/Consent")
    .set("content-type", "application/json");

  expect(res.status).toEqual(200);
  expect(res.body).toEqual(bundleRsponse);
});

it("should return a 404 if the resources does not exists", async () => {
  expect.assertions(1);
  MOCK_FHIR_SERVER.get("/Patient/2").reply(
    404,
    '{"resourceType": "OperationOutcome"}'
  );

  let res = await request(app)
    .get("/Patient/2")
    .set("content-type", "application/json");

  expect(res.status).toEqual(404);
});

it("should return a 400 if the backend response is not (valid) json. XML is not supported at this time.", async () => {
  expect.assertions(1);
  const resourceResponseString = "<Patient></Patient>";
  MOCK_FHIR_SERVER.get("/Patient/1").reply(200, resourceResponseString, {
    "Content-Type": "application/xml; charset=utf-8"
  });

  const res = await request(app)
    .get("/Patient/1")
    .set("content-type", "application/xml");

  expect(res.status).toEqual(400);
});

it("should return a 200 and identical response for POST requests. Only GET is supported at this time.", async () => {
  expect.assertions(2);
  const resource = require("./fixtures/patient.json");
  MOCK_FHIR_SERVER.post("/Patient/100", (body) => body.id === resource.id) //make sure the request body is received.
    .reply(200, resource);

  const res = await request(app)
    .post("/Patient/100")
    .send(resource)
    .set("content-type", "application/json");

  expect(res.status).toEqual(200);
  expect(res.body).toEqual(resource);
});
