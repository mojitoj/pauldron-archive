const _ = require("lodash");
const LabelingUtils = require("./LabelingUtils");

const ADD_DEFAULT_CONFIDENTIALITY_LABEL =
  process.env.ADD_DEFAULT_CONFIDENTIALITY_LABEL === "true";

const ENABLE_LABELING_SERVICE = process.env.ENABLE_LABELING_SERVICE === "true";

const NO_LABEL_RESOURCE_TYPES = (process.env.NO_LABEL_RESOURCE_TYPES || "")
  .split(",")
  .map((res) => res.trim());

function maybeLabelResponse(response) {
  return !ENABLE_LABELING_SERVICE
    ? response
    : response.resourceType === "Bundle"
    ? labelBundle(response)
    : labelResource(response);
}

function labelResource(resource) {
  if (NO_LABEL_RESOURCE_TYPES.includes(resource.resourceType)) {
    return resource;
  }

  let labeledResource = maybeAddDefaultConfidentialityLabelOnResource(resource);
  return labeledResource;
}

function labelResourceEntry(entry) {
  return _.set(_.clone(entry), "resource", labelResource(entry.resource));
}

function labelBundle(bundle) {
  return _.set(_.clone(bundle), "entry", bundle.entry.map(labelResourceEntry));
}

function maybeAddDefaultConfidentialityLabelOnResource(resource) {
  return ADD_DEFAULT_CONFIDENTIALITY_LABEL
    ? LabelingUtils.addDefaultConfidentialityOnResource(resource)
    : resource;
}

module.exports = {
  maybeLabelResponse
};
