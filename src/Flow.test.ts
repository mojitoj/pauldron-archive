import * as mocha from "mocha";
import * as chai from "chai";
import chaiHttp = require("chai-http");
import * as jwt from "jsonwebtoken";
import { Permission } from "./model/Permission";
import _ = require("lodash");
import {App, permissionEndpointURI, authorizationEndpointURI, introspectionEndpointURI, policyEndpointURI} from "./App";
import { SimplePolicy } from "pauldron-policy";
import {instantiateServer, serverInstance} from ".";

const serverInstance2 = instantiateServer(3001);

chai.use(chaiHttp);

const claims: object = {
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
const otherAssertions: object = {
    rpts: [
        {
            serverId: "http://localhost:3001/",
            introspected_permissions: [{resource_id: "test_res_id", resource_scopes: ["s1", "s2"]}]
        }
    ]
};
const permissions: Permission[] = [{resource_id: "test_res_id", resource_scopes: ["s1", "s2"]}];


describe("happyFlow", () => {
    before( async () => {
        const policy = require("./simple-policy.json");
        const policyRes = await chai.request(serverInstance)
            .post(policyEndpointURI)
            .set("content-type", "application/json")
            .send(policy);

        const upstreamPolicy = require("./upstream-server-policy.json");
        const upstreamPolicyRes = await chai.request(serverInstance)
            .post(policyEndpointURI)
            .set("content-type", "application/json")
            .send(policy);
    });

    it("should be able to get an RPT for an authorized client with scopes according to the policy obligations", async () => {
        const registrationRes = await chai.request(serverInstance)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send(permissions);
        chai.assert.exists(registrationRes.body.ticket);
        const ticket: string = registrationRes.body.ticket;
        const claimsToken = jwt.sign(claims, "secret1");

        const authorizationRes = await chai.request(serverInstance)
            .post(authorizationEndpointURI)
            .set("content-type", "application/x-www-form-urlencoded")
            .send({"ticket": ticket, "claim_tokens": claimsToken});
        chai.assert.exists(authorizationRes.body.rpt);
        const rpt: string = authorizationRes.body.rpt;

        const introspectionRes = await chai.request(serverInstance)
            .post(introspectionEndpointURI)
            .set("content-type", "application/x-www-form-urlencoded")
            .send({"token": rpt});
        chai.assert.exists(introspectionRes.body.active);
        chai.assert.exists(introspectionRes.body.iat);
        chai.assert.exists(introspectionRes.body.exp);
        chai.assert.deepEqual(introspectionRes.body.permissions, [{resource_id: "test_res_id", resource_scopes: ["s2"]}]);
    });

    it("should be able to get an RPT for an authorized client after redirecting to upstream UMA.", async () => {
        const registrationRes = await chai.request(serverInstance)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send(permissions);
        chai.assert.exists(registrationRes.body.ticket);
        const ticket: string = registrationRes.body.ticket;

        let newClaims = _.cloneDeep(claims);
        newClaims["client_id"] = "client3";

        const claimsToken = jwt.sign(newClaims, "secret1");

        const authorizationRes = await chai.request(serverInstance)
            .post(authorizationEndpointURI)
            .set("content-type", "application/x-www-form-urlencoded")
            .send({"ticket": ticket, "claim_tokens": claimsToken});
        chai.assert.exists(authorizationRes.body.rpt);
        const rpt: string = authorizationRes.body.rpt;

        const introspectionRes = await chai.request(serverInstance)
            .post(introspectionEndpointURI)
            .set("content-type", "application/x-www-form-urlencoded")
            .send({"token": rpt});
        chai.assert.exists(introspectionRes.body.active);
        chai.assert.exists(introspectionRes.body.iat);
        chai.assert.exists(introspectionRes.body.exp);
        chai.assert.deepEqual(introspectionRes.body.permissions, [{resource_id: "test_res_id", resource_scopes: ["s2"]}]);
    });
});
describe("unhappy flow", () => {
    it("should reject a blacklisted client", async () => {
        const registrationRes = await chai.request(serverInstance)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send(permissions);
        const ticket: string = registrationRes.body.ticket;
        let newClaims = _.cloneDeep(claims);
        newClaims["client_id"] = "client2";
        const claimsToken = jwt.sign(newClaims, "secret1");

        let rptRes = null;
        try {
            rptRes =  await chai.request(serverInstance)
                .post(authorizationEndpointURI)
                .set("content-type", "application/x-www-form-urlencoded")
                .send({"ticket": ticket, "claim_tokens": claimsToken});
        } catch (e) {
            chai.assert.equal(e.status, 403);
            chai.assert.equal(e.response.body.error, "not_authorized");
        }
        chai.assert.isNotOk(rptRes);
    });

    it("should be able to redirect a client to another UMA server according to policy", async () => {
        const registrationRes = await chai.request(serverInstance)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send(permissions);
        const ticket: string = registrationRes.body.ticket;
        let newClaims = _.cloneDeep(claims);
        newClaims["client_id"] = "client3";
        const claimsToken = jwt.sign(newClaims, "secret1");

        let rptRes = null;
        try {
            rptRes =  await chai.request(serverInstance)
                .post(authorizationEndpointURI)
                .set("content-type", "application/x-www-form-urlencoded")
                .send({"ticket": ticket, "claim_tokens": claimsToken});
        } catch (e) {
            chai.assert.exists(e.response.headers["www-authenticate"]);
            chai.assert.equal(e.status, 401);
            chai.assert.equal(e.response.body.error, "uma_redirect");
        }
        chai.assert.isNotOk(rptRes);
    });
});
