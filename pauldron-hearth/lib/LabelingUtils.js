const _ = require("lodash");
const VocabularyUtils = require("./VocabularyUtils");

function addDefaultConfidentialityOnBundle(bundle) {
  return _.set(
    _.cloneDeep(bundle),
    "entry",
    bundle.entry.map(addDefaultConfidentialityToResourceEntry)
  );
}

function addDefaultConfidentialityToResourceEntry(entry) {
  return _.set(
    _.cloneDeep(entry),
    "resource",
    addDefaultConfidentialityOnResource(entry.resource)
  );
}

function addDefaultConfidentialityOnResource(resource) {
  return resourceIsLabeled(resource) &&
    !resourceHasConfidentialityLabel(resource)
    ? resourceAugmentedWithConfidentialityLabel(resource)
    : resource;
}

function resourceAugmentedWithConfidentialityLabel(resource) {
  return _.set(
    _.cloneDeep(resource),
    "meta.security",
    _.concat(resource.meta.security, {
      system: VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM,
      code: VocabularyUtils.DEFAULT_CONFIDENTIALITY_CODE
    })
  );
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

function addConfidentialityHighWaterMark(bundle) {
  const allConfidentialityLabels = bundle.entry
    .map((anEntry) => anEntry.resource)
    .map((resource) => getConfidentialityLabel(resource));

  const hwm = allConfidentialityLabels.reduce(pickHWT, undefined);

  return hwm
    ? assignLabelToBundle(bundle, {
        system: VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM,
        code: hwm
      })
    : bundle;
}

const pickHWT = (acc, current) => {
  return VocabularyUtils.CONFIDENTIALITY_CODE_ORDER[current] >
    VocabularyUtils.CONFIDENTIALITY_CODE_ORDER[acc]
    ? current
    : acc;
};

function assignLabelToBundle(bundle, label) {
  return _.set(
    _.cloneDeep(bundle),
    "meta.security",
    _.concat(bundle.meta.security, label).filter((x) => x)
  );
}

function getConfidentialityLabel(resource) {
  const labels = _.get(resource, "meta.security") || [];
  return _.get(
    _.head(
      labels.filter(
        (label) => label.system === VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM
      )
    ),
    "code"
  );
}

const CODE_SYSTEMS_OF_INTEREST = (
  process.env.DESIGNATED_SECURITY_LABEL_SYSTEMS || ""
)
  .split(",")
  .map((res) => res.trim());

function filterLabelsOfInterest(labels) {
  return labels.filter((label) =>
    CODE_SYSTEMS_OF_INTEREST.includes(label.system)
  );
}

function augmentSecurityLabel(labels) {
  if (!labels || !labels.length) {
    return [
      {
        system: VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM,
        code: VocabularyUtils.DEFAULT_CONFIDENTIALITY_CODE
      }
    ];
  }
  return labels;
}

function trimLabels(labels) {
  return labels.map((label) => _.pick(label, ["system", "code"]));
}

module.exports = {
  addDefaultConfidentialityOnResource,
  addDefaultConfidentialityOnBundle,
  addConfidentialityHighWaterMark,
  filterLabelsOfInterest,
  augmentSecurityLabel,
  trimLabels
};
