import * as mocha from "mocha";
import * as chai from "chai";
import chaiHttp = require("chai-http");
import { Permission } from "./model/Permission";

import app from "../src/App";
import {permissionEndpointURI} from "../src/App";
import {authorizationEndpointURI} from "../src/App";
import {introspectionEndpointURI} from "../src/App";



chai.use(chaiHttp);

describe("happyFlow", () => {
    it("should be able to get an RPT", async () => {
        const permissions: Permission[] = [{resource_id: "test_res_id", resource_scopes: ["ScopeA", "ScopeB"]}];
        const registrationRes = await chai.request(app)
            .post(permissionEndpointURI)
            .set("content-type", "application/json")
            .send(permissions);
        chai.assert.exists(registrationRes.body.ticket);
        const ticket: string = registrationRes.body.ticket;

        const authorizationRes = await chai.request(app)
            .post(authorizationEndpointURI)
            .set("content-type", "application/x-www-form-urlencoded")
            .send({"ticket": ticket});
        chai.assert.exists(authorizationRes.body.rpt);
        const rpt: string = authorizationRes.body.rpt;

        const introspectionRes = await chai.request(app)
            .post(introspectionEndpointURI)
            .set("content-type", "application/x-www-form-urlencoded")
            .send({"token": rpt});
        chai.assert.exists(introspectionRes.body.active);
        chai.assert.exists(introspectionRes.body.iat);
        chai.assert.exists(introspectionRes.body.exp);
        chai.assert.deepEqual(introspectionRes.body.permissions, permissions);
    });
});
