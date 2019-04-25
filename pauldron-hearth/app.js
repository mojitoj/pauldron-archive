const express = require("express");
const morgan = require("morgan");
const proxy = require('http-proxy-middleware')
const logger = require("./lib/logger");

const FHIRProxy = require("./controllers/FHIRProxy");

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE;

const app = express();

//middlewares
app.use(morgan("dev"));

const proxyOptions = {
    target: FHIR_SERVER_BASE,
    onProxyRes: FHIRProxy.onProxyRes,
    onProxyReq: FHIRProxy.onProxyReq,
    xfwd: true,
    changeOrigin: true,
    selfHandleResponse: true
};

logger.info(`Starting the proxy with UMA mode turned ${ process.env.UMA_MODE !== "false" ? "on" : "off"}`);
app.use("/", FHIRProxy.requestPreprocess);
app.use("/", proxy(proxyOptions));

module.exports = {
    app
};
