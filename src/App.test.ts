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
        const res = await chai.request(app).get("/permissions");
        chai.assert.typeOf(res.body, "array");
    });
});