const CONFIDENTIALITY_CODE_SYSTEM =
  "http://terminology.hl7.org/CodeSystem/v3-Confidentiality";

const DEFAULT_CONFIDENTIALITY_CODE =
  process.env.DEFAULT_CONFIDENTIALITY_CODE || "M";

const CONFIDENTIALITY_CODE_ORDER = {
  undefined: -1,
  U: 0,
  L: 1,
  M: 2,
  N: 3,
  R: 4,
  V: 5
};

module.exports = {
  CONFIDENTIALITY_CODE_SYSTEM,
  DEFAULT_CONFIDENTIALITY_CODE,
  CONFIDENTIALITY_CODE_ORDER
};
