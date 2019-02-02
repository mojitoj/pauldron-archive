require("dotenv").config({path: ".env.test"});
process.env.NODE_ENV = "test";

async function setUp() {
}

module.exports = setUp;
