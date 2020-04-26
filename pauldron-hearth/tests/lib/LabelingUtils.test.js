const _ = require("lodash");

const LabelingUtils = require("../../lib/LabelingUtils");
const VocabularyUtils = require("../../lib/VocabularyUtils");

it("should assign hwm label to a bundle", async () => {
  const bundle = require("../fixtures/consent-bundl-with-labeled-resource.json");
  _.set(bundle, "entry[0].resource.meta.security", [
    {
      system: VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM,
      code: "R"
    }
  ]);
  _.set(bundle, "entry[1].resource.meta.security", [
    {
      system: VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM,
      code: "N"
    }
  ]);

  const labeledBundle = LabelingUtils.addConfidentialityHighWaterMark(bundle);
  expect(labeledBundle.meta.security).toEqual(
    expect.arrayContaining([
      {
        system: VocabularyUtils.CONFIDENTIALITY_CODE_SYSTEM,
        code: "R"
      }
    ])
  );
});

it("should leave unlabled bundle with no labeled resources intact", async () => {
  const bundle = require("../fixtures/consent-bundle.json");

  const labeledBundle = LabelingUtils.addConfidentialityHighWaterMark(bundle);
  expect(labeledBundle.meta.security).toBeUndefined();
});
