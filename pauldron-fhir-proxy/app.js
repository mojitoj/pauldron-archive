const express = require("express");
const morgan = require("morgan");
const bodyParser = require("body-parser");

const FHIRProxy = require("./controllers/FHIRProxy");

const app = express();

//middlewares
app.use(morgan("dev"));
app.use(bodyParser.json({type: "application/json"}));
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/*", FHIRProxy.get);

module.exports = {
    app
};
