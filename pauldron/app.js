const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");

const PermissionEndpoint = require("./controllers/permission-endpoint");
const AuthorizationEndpoint = require("./controllers/authorization-endpoint");
const IntrospectionEndpoint = require("./controllers/introspection-endpoint");
const PolicyEndpoint = require("./controllers/policy-endpoint");
const OAuth2AuthorizationEndpoint = require("./controllers/oauth2-endpoint");


const PERMISSION_ENDPOINT_URI = "/protection/permissions";
const INTROSPECTION_ENDPOINT_URI = "/protection/introspection";
const AUTHORIZATION_ENDPOINT_URI = "/authorization";
const OAUTH2_AUTHORIZATION_ENDPOINT_URI = "/oauth2/authorization";
const POLICY_ENDPOINT_URI = "/policies";

const app = express();

//middlewares
app.use(morgan("dev"));
app.use(bodyParser.json({type: "application/json"}));
app.use(bodyParser.urlencoded({ extended: false }));

//routes
app.get(`${PERMISSION_ENDPOINT_URI}/`, PermissionEndpoint.list);
app.post(`${PERMISSION_ENDPOINT_URI}/`, PermissionEndpoint.create);
app.post(`${AUTHORIZATION_ENDPOINT_URI}/`, AuthorizationEndpoint.create);
app.post(`${INTROSPECTION_ENDPOINT_URI}/`, IntrospectionEndpoint.introspect);

app.post(`${OAUTH2_AUTHORIZATION_ENDPOINT_URI}/`, OAuth2AuthorizationEndpoint.create);

app.post(`${POLICY_ENDPOINT_URI}/`, PolicyEndpoint.create);
app.get(`${POLICY_ENDPOINT_URI}/`, PolicyEndpoint.list);
app.get(`${POLICY_ENDPOINT_URI}/:id`, PolicyEndpoint.get);
app.delete(`${POLICY_ENDPOINT_URI}/:id`, PolicyEndpoint.del);

module.exports = {
    PERMISSION_ENDPOINT_URI,
    INTROSPECTION_ENDPOINT_URI,
    AUTHORIZATION_ENDPOINT_URI,
    POLICY_ENDPOINT_URI,
    OAUTH2_AUTHORIZATION_ENDPOINT_URI,
    app
};
