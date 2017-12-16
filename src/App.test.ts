import * as mocha from "mocha";
import * as chai from "chai";
import chaiHttp = require("chai-http");

import { App, permissionEndpointURI, policyEndpointURI } from "./App";

const testConfigs = require("./test-config.json");
const theServerConfig = require("./config.json");

chai.use(chaiHttp);

const app = new App(theServerConfig).express;

describe("routs", () => {

    it("should be json", async () => {
        const res = await chai.request(app).get("/");
        chai.assert.equal(res.type, "application/json");
    });

    it("should have a message prop", async () => {
        const res = await chai.request(app).get("/");
        chai.assert.exists(res.body.path);
        chai.assert.equal(res.body.path, "root");
    });
});

describe("permissionsEndpoint", () => {
    it("should be a json object", async () => {
        const res = await chai.request(app)
            .get(permissionEndpointURI)
            .set("Authorization", `Bearer ${testConfigs.testProtectionAPIKey}`);
        chai.assert.typeOf(res.body, "object");
    });

    it("should be able to create a ticket from a permission and list it only with the right APIUser", async () => {
        let res = await chai.request(app)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .set("Authorization", `Bearer ${testConfigs.testProtectionAPIKey}`)
            .send({resource_id: "test_res_id", resource_scopes: ["s1", "s2"]});
        chai.assert.exists(res.body.ticket);
        const ticket = res.body.ticket;

        res = await chai.request(app)
            .get(permissionEndpointURI)
            .set("Authorization", `Bearer ${testConfigs.testProtectionAPIKey}`);
        chai.assert.typeOf(res.body, "object");
        chai.assert.containsAllKeys(res.body, [ticket]);

        res = await chai.request(app)
            .get(permissionEndpointURI)
            .set("Authorization", `Bearer ${testConfigs.anotherTestProtectionAPIKey}`);
        chai.assert.notOk(res.body[ticket]);
    });

    it("should be able to create a ticket from a permission array", async () => {
        const res = await chai.request(app)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .set("Authorization", `Bearer ${testConfigs.testProtectionAPIKey}`)
            .send([{resource_id: "test_res_id", resource_scopes: ["s1", "s2"]}]);
        chai.assert.exists(res.body.ticket);
    });

    it("should reject malformed requests", async () => {
        let res = null;
        try {
            res =  await chai.request(app)
                .post(permissionEndpointURI)
                .set("content-type", "application/json")
                .set("Authorization", `Bearer ${testConfigs.testProtectionAPIKey}`)
                .send([]);
        } catch (e) {
            chai.assert.equal(e.status, 400);
            chai.assert.equal(e.response.body.error, "missing_parameter");
        }
        chai.assert.isNotOk(res);

        res = null;
        try {
            res =  await chai.request(app)
                .post(permissionEndpointURI)
                .set("Authorization", `Bearer ${testConfigs.testProtectionAPIKey}`)
                .set("content-type", "application/json")
                .send([{}]);
        } catch (e) {
            chai.assert.equal(e.status, 400);
            chai.assert.equal(e.response.body.error, "missing_parameter");
        }
        chai.assert.isNotOk(res);

        res = null;
        try {
            res =  await chai.request(app)
                .post(permissionEndpointURI)
                .set("content-type", "application/json")
                .set("Authorization", `Bearer ${testConfigs.testProtectionAPIKey}`)
                .send({resource_id: "test_res_id", resource_scopes: "ScopeA"});
        } catch (e) {
            chai.assert.equal(e.status, 400);
            chai.assert.equal(e.response.body.error, "missing_parameter");
        }
        chai.assert.isNotOk(res);

        res = null;
        try {
            res =  await chai.request(app)
                .post(permissionEndpointURI)
                .set("content-type", "application/json")
                .set("Authorization", `Bearer ${testConfigs.testProtectionAPIKey}`)
                .send([{resource_id: "test_res_id", resource_scopes: "s1"}]);
        } catch (e) {
            chai.assert.equal(e.status, 400);
            chai.assert.equal(e.response.body.error, "missing_parameter");
        }
        chai.assert.isNotOk(res);
    });
});

describe("policyEndpoint", () => {
    it("should accept a new policy", async () => {
        const policy = require("./simple-policy.json");
        const policyRes = await chai.request(app)
            .post(policyEndpointURI)
            .set("content-type", "application/json")
            .set("Authorization", `Bearer ${testConfigs.testPolicyEndpointAPIKey}`)
            .send(policy);

        const policyId = policyRes.body.id;

        let res = await chai.request(app)
            .get(policyEndpointURI)
            .set("Authorization", `Bearer ${testConfigs.testPolicyEndpointAPIKey}`);
        chai.assert.exists(res.body[0]);
        chai.assert.equal(res.body[0].id, policyId);

        res = await chai.request(app)
            .get(policyEndpointURI + "/" + policyId)
            .set("Authorization", `Bearer ${testConfigs.testPolicyEndpointAPIKey}`);

        chai.assert.deepEqual(res.body, {id: policyId, ... policy});
    });
});