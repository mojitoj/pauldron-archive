const _ = require("lodash");
const VocabularyUtils = require("./VocabularyUtils");

function addDefaultConfidentialityOnBundle(bundle) {
    return _.set(_.clone(bundle), "entry", bundle.entry.map(addDefaultConfidentialityToResourceEntry));
}

function addDefaultConfidentialityToResourceEntry(entry) {
    return _.set(_.clone(entry), "resource", addDefaultConfidentialityOnResource(entry.resource));
}

function addDefaultConfidentialityOnResource(resource) {
  return resourceIsLabeled(resource) &&
    !resourceHasConfidentialityLabel(resource)
    ? resourceAugmentedWithConfidentialityLabel(resource)
    : resource;
}

function resourceAugmentedWithConfidentialityLabel(resource) {
    return _.set(_.clone(resource), "meta.security", _.concat(resource.meta.security, {
        system: VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM,
        code: VocabularyUtils.DEFAULT_CONFIDENTIALITY_CODE
    }));
}

function resourceHasConfidentialityLabel(resource) {
  const securityLabels = resource.meta.security || [];
  return securityLabels.some(
    (label) => label.system === VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM
  );
}

function resourceIsLabeled(resource) {
  return resource.meta.security;
}

module.exports = {
    addDefaultConfidentialityOnResource,
    addDefaultConfidentialityOnBundle
}
