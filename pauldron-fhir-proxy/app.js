const express = require("express");
const morgan = require("morgan");
const proxy = require('http-proxy-middleware')

const FHIRProxy = require("./controllers/FHIRProxy");

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE;

const app = express();

//middlewares
app.use(morgan("dev"));

const proxyOptions = {
    target: FHIR_SERVER_BASE,
    onProxyRes: FHIRProxy.onProxyRes,
    xfwd: true,
    selfHandleResponse: true
};

app.use("/", proxy(proxyOptions));

module.exports = {
    app
};
