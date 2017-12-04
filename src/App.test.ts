import * as mocha from "mocha";
import * as chai from "chai";
import chaiHttp = require("chai-http");

import { App, permissionEndpointURI, policyEndpointURI } from "./App";

chai.use(chaiHttp);
const app = new App().express;

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
    it("should be a json array", async () => {
        const res = await chai.request(app)
            .get(permissionEndpointURI);
        chai.assert.typeOf(res.body, "object");
    });

    it("should be able to create a ticket from a permission", async () => {
        const res = await chai.request(app)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send({resource_id: "test_res_id", resource_scopes: ["ScopeA", "ScopeB"]});
        chai.assert.exists(res.body.ticket);
    });

    it("should be able to create a ticket from a permission array", async () => {
        const res = await chai.request(app)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send([{resource_id: "test_res_id", resource_scopes: ["ScopeA", "ScopeB"]}]);
        chai.assert.exists(res.body.ticket);
    });

    it("should reject malformed requests", () => {
        chai.request(app)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send([]).end((err, res) => {
                res.should.have.status(400);
              });
        chai.request(app)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send([{}]).end((err, res) => {
                res.should.have.status(400);
              });

        chai.request(app)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send({resource_id: "test_res_id", resource_scopes: "ScopeA"})
            .end((err, res) => {
                  res.should.have.status(400);
            });

        chai.request(app)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send([{resource_id: "test_res_id", resource_scopes: "ScopeA"}])
            .end((err, res) => {
                  res.should.have.status(400);
            });
    });
});

describe("policyEndpoint", () => {
    it("should accept a new policy", async () => {
        const policy = require("./simple-policy.json");
        const policyRes = await chai.request(app)
            .post(policyEndpointURI)
            .set("content-type", "application/json")
            .send(policy);

        const policyId = policyRes.body.id;

        let res = await chai.request(app)
            .get(policyEndpointURI);
        chai.assert.exists(res.body[0]);
        chai.assert.equal(res.body[0].id, policyId);

        res = await chai.request(app)
            .get(policyEndpointURI + "/" + policyId);

        chai.assert.deepEqual(res.body, {id: policyId, ... policy});
    });
});