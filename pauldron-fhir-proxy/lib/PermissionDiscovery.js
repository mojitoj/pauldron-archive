const rp = require("request-promise");
const hash = require("object-hash");
const _ = require("lodash");

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE;

const DESIGNATED_PATIENT_ID_SYSTEMS = (process.env.DESIGNATED_PATIENT_ID_SYSTEMS || "")
                                        .split(",")
                                        .map(res => res.trim());
const CONFIDENTIALITY_CODE_SYSTEM = "http://hl7.org/fhir/v3/Confidentiality"
const CODE_SYSTEMS_OF_INTEREST = [CONFIDENTIALITY_CODE_SYSTEM];

async function getRequiredPermissions(resource) {
    const theResourceType = resource.resourceType;
    const fhirUMAPermissions = [];
    if (theResourceType === "Bundle") {
        if (resource.total > 0) { // non-empty bundle
            fhirUMAPermissions.push.apply(fhirUMAPermissions, resource.entry.map( (entry) => (
                new Promise(async function (resolve, reject) {
                    try {
                        resolve(
                            {
                                resource_set_id: {
                                    patientId: await getPatientId(entry.resource),
                                    resourceType: entry.resource.resourceType
                                },
                                scopes: securityLabelsToScopes(entry.resource.meta.security || [])
                            }
                        );
                    } catch (e) {
                        reject(e);
                    }
                })
            )));
        }
    } else { // if it's just one single plain resource
        fhirUMAPermissions.push(
            new Promise(async function (resolve, reject) {
                try {
                    resolve(
                        {
                            resource_set_id: {
                                patientId: await getPatientId(resource),
                                resourceType: theResourceType
                            },
                            scopes: securityLabelsToScopes(resource.meta.security || [])
                        }
                    );
                } catch (e) {
                    reject(e);
                }
            })
        );
    }

    const resolvedPermissions = await Promise.all(fhirUMAPermissions);

    const consolidatedUmaPermissions = resolvedPermissions.map ((umaPermission) => (
        {
            hash: hash(umaPermission.resource_set_id),
            value: umaPermission
        }
    ))
    .reduce((sofar, thisOne) => (
        sofar[thisOne.hash]
        ? (
            Object.assign(sofar,
                {
                    [thisOne.hash] : {
                        resource_set_id : thisOne.value.resource_set_id,
                        scopes: arrayMergeDeep(thisOne.value.scopes, sofar[thisOne.hash].scopes)
                    }
                })
        )
        : (
            Object.assign(sofar,
                {
                    [thisOne.hash] : thisOne.value
                })
        )
    ), {});
    return ( Object.values(consolidatedUmaPermissions));
}

function arrayMergeDeep(array1, array2) {
    return _.unionWith(array1, array2, _.isEqual);
}

function augmentSecurityLabel(labels) {
    if (!labels || !labels.length) {
        return [{
            system: CONFIDENTIALITY_CODE_SYSTEM,
            code: "N",
        }];
    }
    return labels;
}
function securityLabelsToScopes(labels) {
    const augmentedLabels = augmentSecurityLabel(labels)
    const filteredLabels = augmentedLabels.filter((label) => (
        CODE_SYSTEMS_OF_INTEREST.includes(label.system)
    ));
    // only system and code
    const trimmedLabels = filteredLabels.map((label) => (
        _.pick(label, ["system", "code"])
    ));
    return trimmedLabels;
}
async function getPatientId(plainResource) { // the input is a primitive FHIR resource and not a bundle.
    const patientReference = (plainResource.subject) || (plainResource.patient);
    if (!patientReference || !(patientReference.reference)) {
        throw {
            error: "patient_not_found",
            message: `Unable to identify the patient for resource ${plainResource.id}.`
        };
    }
    const patientURL = `${FHIR_SERVER_BASE}/${patientReference.reference}`;
    let patient = null;

    const options = {
        method: "GET",
        json: true,
        uri: patientURL,
        cacheKey: patientURL,
        cacheTTL: 5000
    }; //todo: this cache doesn't seem to work 

    try {
        patient = await rp(options);
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
            message: `Patient ${patientURL} must have an identifier.`
        };
    }

    const designatedIdentifiers = identifiers.filter((identifier) => (
        DESIGNATED_PATIENT_ID_SYSTEMS.includes(identifier.system)
    ));

    const identifier = _.sortBy(designatedIdentifiers, 
            (did) => (DESIGNATED_PATIENT_ID_SYSTEMS.indexOf(did.system))
        )[0] || identifiers[0];

    return identifier.value;
}

module.exports = {
    getRequiredPermissions
}
