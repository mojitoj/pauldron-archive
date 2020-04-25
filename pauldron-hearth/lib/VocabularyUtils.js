const CONFIDENTIALITY_CODE_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/v3-Confidentiality";

const DEFAULT_CONFIDENTIALITY_CODE = process.env.DEFAULT_CONFIDENTIALITY_CODE || "M";

module.exports = {
  CONFIDENTIALITY_CODE_SYSTEM,
  DEFAULT_CONFIDENTIALITY_CODE
};
