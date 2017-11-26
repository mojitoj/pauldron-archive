import * as mocha from 'mocha';
import * as chai from 'chai';
import chaiHttp = require('chai-http');

import app from '../src/App';

chai.use(chaiHttp);

describe('baseRoute', async () => {

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

describe('permissionsEndpoint', async () => {
    
    it("should be a json array", async () => {
        const res = await chai.request(app)
            .get("/permissions");
        chai.assert.typeOf(res.body, "object");
    });

    it("should be able to create a ticket from a permission", async () => {        
        const res = await chai.request(app)
            .post("/permissions")
            .set("content-type", "application/json")
            .send({resource_id: "test_res_id",resource_scopes:["ScopeA", "ScopeB"]});
        chai.assert.exists(res.body.ticket);
    });

    it("should be able to create a ticket from a permission array", async () => {        
        const res = await chai.request(app)
            .post("/permissions")
            .set("content-type", "application/json")
            .send([{resource_id: "test_res_id",resource_scopes:["ScopeA", "ScopeB"]}]);
        chai.assert.exists(res.body.ticket);
    });

    it("should reject malformed requests", () => {        
        chai.request(app)
            .post("/permissions")
            .set("content-type", "application/json")
            .send([]).end((err, res) => {
                res.should.have.status(400);
              });
        chai.request(app)
            .post("/permissions")
            .set("content-type", "application/json")
            .send([{}]).end((err, res) => {
                res.should.have.status(400);
              });

        chai.request(app)
            .post("/permissions")
            .set("content-type", "application/json")
            .send({resource_id: "test_res_id",resource_scopes:"ScopeA"})
            .end((err, res) => {
                  res.should.have.status(400);
            });
  
        chai.request(app)
            .post("/permissions")
            .set("content-type", "application/json")
            .send([{resource_id: "test_res_id",resource_scopes:"ScopeA"}])
            .end((err, res) => {
                  res.should.have.status(400);
            });
    });

});