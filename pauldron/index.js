require('dotenv').config();

const { 
    app,
    PERMISSION_ENDPOINT_URI,
    INTROSPECTION_ENDPOINT_URI,
    AUTHORIZATION_ENDPOINT_URI,
    OAUTH2_AUTHORIZATION_ENDPOINT_URI,
    POLICY_ENDPOINT_URI
} = require("./app");

const db = require("./lib/db");
const ClaimIssuers = require("./lib/claims-issuers");

module.exports ={
    app,
    db,
    ClaimIssuers,
    PERMISSION_ENDPOINT_URI,
    INTROSPECTION_ENDPOINT_URI,
    AUTHORIZATION_ENDPOINT_URI,
    OAUTH2_AUTHORIZATION_ENDPOINT_URI,
    POLICY_ENDPOINT_URI
}
