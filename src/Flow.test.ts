import * as mocha from "mocha";
import * as chai from "chai";
import chaiHttp = require("chai-http");
import * as jwt from "jsonwebtoken";
import { Permission } from "./model/Permission";
import _ = require("lodash");
import {App, permissionEndpointURI, authorizationEndpointURI, introspectionEndpointURI, policyEndpointURI} from "./App";
import { SimplePolicy } from "./policy/SimplePolicyEngine";

const app = new App().express;

chai.use(chaiHttp);

const claims: object = {
    client_id: "client1",
    organization: "org1",
    iss: "sampleIssuer1",
    pou: {
        system: "http://hl7.org/fhir/v3/PurposeOfUse",
        code: "TREAT"
    }
};
const permissions: Permission[] = [{resource_id: "test_res_id", resource_scopes: ["s1", "s2"]}];


describe("happyFlow", () => {
    before( async () => {
        const policy = require("./simple-policy.json");
        const policyRes = await chai.request(app)
            .post(policyEndpointURI)
            .set("content-type", "application/json")
            .send(policy);
    });

    it("should be able to get an RPT with scopes according to the policy obligations", async () => {
        const registrationRes = await chai.request(app)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send(permissions);
        chai.assert.exists(registrationRes.body.ticket);
        const ticket: string = registrationRes.body.ticket;

        const claims: object = {
            client_id: "client1",
            iss: "sampleIssuer1",
            pou: {
                system: "http://hl7.org/fhir/v3/PurposeOfUse",
                code: "TREAT"
            }
        };
        const claimsToken = jwt.sign(claims, "secret1");

        const authorizationRes = await chai.request(app)
            .post(authorizationEndpointURI)
            .set("content-type", "application/x-www-form-urlencoded")
            .send({"ticket": ticket, "claim_tokens": claimsToken});
        chai.assert.exists(authorizationRes.body.rpt);
        const rpt: string = authorizationRes.body.rpt;

        const introspectionRes = await chai.request(app)
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
        const registrationRes = await chai.request(app)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send(permissions);
        const ticket: string = registrationRes.body.ticket;
        let newClaims = _.cloneDeep(claims);
        newClaims["client_id"] = "client2";
        const claimsToken = jwt.sign(newClaims, "secret1");

        let rptRes = null;
        try {
            rptRes =  await chai.request(app)
                .post(authorizationEndpointURI)
                .set("content-type", "application/x-www-form-urlencoded")
                .send({"ticket": ticket, "claim_tokens": claimsToken});
        } catch (e) {
            chai.assert.equal(e.status, 403);
            chai.assert.equal(e.response.body.error, "not_authorized");
        }
        chai.assert.isNotOk(rptRes);
    });
});
