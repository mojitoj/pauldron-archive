
const nock = require("nock");

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE || "https://mock-fhir-server/base";
const MOCK_FHIR_SERVER = nock(FHIR_SERVER_BASE)
                        .defaultReplyHeaders({"Content-Type": "application/json; charset=utf-8"})
                        .replyContentLength();

const patient = require("../fixtures/patient.json");
const bundle = require("../fixtures/specimen-bundle.json");


it("correctly constructs permissions for a bundle with more than one security label system.", async () => {
    expect.assertions(11);

    const DESIGNATED_SECURITY_LABEL_SYSTEMS = process.env.DESIGNATED_SECURITY_LABEL_SYSTEMS;
    const CONF = "http://terminology.hl7.org/CodeSystem/v3-Confidentiality";
    const SENS = "http://terminology.hl7.org/CodeSystem/v3-ActCode";
    process.env.DESIGNATED_SECURITY_LABEL_SYSTEMS = `${CONF},${SENS}`;
    let PermissionDiscovery = require("../../lib/PermissionDiscovery");
    
    bundle.entry[0].resource.meta.security = [{
        system : SENS,
        code : "ETH"
    }];

    MOCK_FHIR_SERVER.get("/Patient/1")
        .times(4) //when caching fixed remove this 
        .reply(200, patient);

    const permissions = await PermissionDiscovery.getRequiredPermissions(bundle, "read");
    expect(permissions).toHaveLength(2);
    expect(permissions[0]).toHaveProperty("resource_set_id");
    expect(permissions[0]).toHaveProperty("scopes");
    expect(permissions[0].resource_set_id).toHaveProperty("securityLabel");
    expect(permissions[0].resource_set_id.securityLabel).toHaveLength(1);
    expect(permissions[1].resource_set_id).toHaveProperty("securityLabel");
    expect(permissions[1].resource_set_id.securityLabel).toHaveLength(1);
    expect(permissions[0].resource_set_id).toMatchObject({patientId:{system:"urn:official:id",value:"10001"},resourceType:"Specimen"});
    expect(permissions[1].resource_set_id).toMatchObject({patientId:{system:"urn:official:id",value:"10001"},resourceType:"Specimen"});
    expect(permissions[0].scopes).toHaveLength(1);
    expect(permissions[1].scopes).toHaveLength(1);

    process.env.DESIGNATED_SECURITY_LABEL_SYSTEMS = DESIGNATED_SECURITY_LABEL_SYSTEMS;
    PermissionDiscovery = require("../../lib/PermissionDiscovery");
});
