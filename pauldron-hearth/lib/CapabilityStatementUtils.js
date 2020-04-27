const _ = require("lodash");

const AUGMENT_CAPABILITY_STATEMENT =
  process.env.AUGMENT_CAPABILITY_STATEMENT === "true";

const SECURITY = {
  coding: [
    {
      system: "http://terminology.hl7.org/CodeSystem/restful-security-service",
      code: "OAuth"
    }
  ],
  text: `OAuth 2.0 (Section 4.4.2)/UMA by Pauldron (https://github.com/mojitoj/pauldron/tree/master/pauldron), Server located at: ${process.env.UMA_SERVER_BASE}`
};

const IG =
  "http://hl7.org/fhir/uv/security-label-ds4p/ImplementationGuide/hl7.fhir.uv.security-label-ds4p";

function addSecurityMechanism(capStatement) {
  const restServiceExists = _.get(capStatement, "rest[0]");
  const existingSecServices =
    _.get(capStatement, "rest[0].security.service") || [];

  return restServiceExists
    ? _.set(
        _.cloneDeep(capStatement),
        "rest[0].security.service",
        _.concat(existingSecServices, SECURITY)
      )
    : capStatement;
}

function addIg(capStatement) {
  const existingIgs = _.get(capStatement, "implementationGuide") || [];
  return _.set(
    _.cloneDeep(capStatement),
    "implementationGuide",
    _.concat(existingIgs, IG)
  );
}

function onlyJson(capStatement) {
  const formats = _.get(capStatement, "format") || [];
  return _.set(
    _.cloneDeep(capStatement),
    "format",
    formats.filter((format) => format.includes("json"))
  );
}

function maybeAugmentCapabilityStatement(response) {
  return AUGMENT_CAPABILITY_STATEMENT &&
    response.resourceType === "CapabilityStatement"
    ? addSecurityMechanism(addIg(onlyJson(response)))
    : response;
}

module.exports = {
  maybeAugmentCapabilityStatement,
  SECURITY,
  IG
};
