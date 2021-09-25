const superagent = require("superagent");
const _ = require("lodash");

const LabelingUtils = require("./LabelingUtils");

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE;

const DESIGNATED_PATIENT_ID_SYSTEMS = (
  process.env.DESIGNATED_PATIENT_ID_SYSTEMS || ""
)
  .split(",")
  .map((res) => res.trim());

async function getRequiredPermissions(resource, action) {
  const theResourceType = resource.resourceType;
  const resourceArray =
    theResourceType === "Bundle"
      ? resource.entry.map((entry) => entry.resource)
      : [resource];

  const fhirUMAPermissions = resourceArray.map(
    (resource) =>
      new Promise(async function (resolve, reject) {
        try {
          resolve({
            resource_set_id: {
              patientId: await getPatientId(resource),
              resourceType: resource.resourceType,
              securityLabel: securityLabelsToScopes(
                resource.meta.security || []
              )
            },
            scopes: [action]
          });
        } catch (e) {
          reject(e);
        }
      })
  );

  const resolvedPermissions = await Promise.all(fhirUMAPermissions);

  const consolidatedUmaPermissions =
    consolidatePermissions(resolvedPermissions);
  return Object.values(consolidatedUmaPermissions);
}

function consolidatePermissions(permissions) {
  return _.unionWith(permissions, permissions, _.isEqual);
}

function securityLabelsToScopes(labels) {
  return LabelingUtils.trimLabels(
    LabelingUtils.filterLabelsOfInterest(
      LabelingUtils.augmentSecurityLabel(labels)
    )
  );
}
async function getPatientId(plainResource) {
  // the input is a primitive FHIR resource and not a bundle.
  const patientReference = plainResource.subject || plainResource.patient;
  if (!patientReference || !patientReference.reference) {
    throw {
      error: "patient_not_found",
      message: `Unable to identify the patient for resource ${plainResource.resourceType}(id: ${plainResource.id})`
    };
  }
  const patientURL = `${FHIR_SERVER_BASE}/${patientReference.reference}`;
  let patient = null;

  try {
    const patientResponse = await superagent
      .get(patientURL)
      .set({ Accept: "application/json" });
    //todo: cache this
    patient = patientResponse.body;
  } catch (e) {
    throw {
      error: "patient_not_found",
      message: `Cannot find patient ${patientURL}. Reason: ${e.message}`
    };
  }

  const identifiers = patient.identifier;
  if (!identifiers) {
    throw {
      error: "patient_not_found",
      message: `Patient ${patientURL} must have an identifier`
    };
  }

  const designatedIdentifiers = identifiers.filter((identifier) =>
    DESIGNATED_PATIENT_ID_SYSTEMS.includes(identifier.system)
  );

  const identifier =
    _.sortBy(designatedIdentifiers, (did) =>
      DESIGNATED_PATIENT_ID_SYSTEMS.indexOf(did.system)
    )[0] || identifiers[0];

  return _.pick(identifier, ["system", "value"]);
}

module.exports = {
  getRequiredPermissions
};
