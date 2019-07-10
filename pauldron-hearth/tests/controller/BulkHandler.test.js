const request = require("supertest");
const nock = require("nock");
const _ = require("lodash");


const BulkHandler = require("../../controllers/BulkHandler");

const PREVIOUS_UMA_MODE = process.env.UMA_MODE;
process.env.UMA_MODE = "false";

const FHIR_SERVER_BASE = process.env.FHIR_SERVER_BASE || "https://mock-fhir-server/base";
const MOCK_FHIR_SERVER = nock(FHIR_SERVER_BASE);

const {app} = require("../../app");

const PERMISSIONS_WILDCARD_GRANT_WITH_LABEL_EXCEPTIONS = [
    {
        resource_set_id: {
            patientId: "*",
            resourceType: "*",
            securityLabel: "*"
        },
        scopes: ["bulk-export"]
    },
    {
        resource_set_id: {
            patientId: "*",
            resourceType: "*",
            securityLabel: [
                {
                    system: "http://terminology.hl7.org/ValueSet/v3-ConfidentialityClassification",
                    code: "R"
                }
            ]
        },
        deny: true,
        scopes: ["bulk-export"]
    }
];

const PERMISSIONS_WILDCARD_GRANT_WITH_RESOURCE_TYPE_AND_LABEL_EXCEPTIONS = [
    {
        resource_set_id: {
            patientId: "*",
            resourceType: "*",
            securityLabel: "*"
        },
        scopes: ["bulk-export"]
    },
    {
        resource_set_id: {
            patientId: "*",
            resourceType: ["MedicationRequest"],
            securityLabel: [
                {
                    system: "http://terminology.hl7.org/ValueSet/v3-ConfidentialityClassification",
                    code: "R"
                }
            ]
        },
        deny: true,
        scopes: ["bulk-export"]
    }
];

const INTROSPECTION_RESPONSE_TEMPLATE = {
    id: "b8f6000a",
    iat: 1556041618727,
    exp: 1556041638727,
    realm: "example",
    permissions: PERMISSIONS_WILDCARD_GRANT_WITH_LABEL_EXCEPTIONS,
    active: true
};

const AUTH_SERVER_BASE = process.env.UMA_SERVER_BASE || "https://mock-uma-server/";
const AUTH_SERVER_INTROSPECTION_ENDPOINT = process.env.UMA_SERVER_INTROSPECTION_ENDPOINT || "/protection/introspection";
const MOCK_AUTH_SERVER = nock(AUTH_SERVER_BASE)
                        .defaultReplyHeaders({"Content-Type": "application/json; charset=utf-8"})
                        .replyContentLength();


                        
afterAll(async () => {
    nock.restore();
    process.env.UMA_MODE = PREVIOUS_UMA_MODE;
});



describe ("proper adjustment of client query based on client's scopes on the outgoing request", () => {
    it("sends a 403 with bad rpt", async () => {
        const rpt = "BAD_RPT";
        
        const res = await request(app)
            .get("/$export?_since=2019-04-20")
            .set("content-type", "application/json")
            .set("authorization", `Bearer ${rpt}`);
        
        expect(res.status).toEqual(403);
    });

    it("sends a 403 with insufficient scopes", async () => {
        const rpt = "INSUFFICIENT_RPT";

        const introspectionResponse = _.cloneDeep(INTROSPECTION_RESPONSE_TEMPLATE);
        introspectionResponse.permissions = PERMISSIONS_WILDCARD_GRANT_WITH_RESOURCE_TYPE_AND_LABEL_EXCEPTIONS;
        
        MOCK_AUTH_SERVER
            .post(AUTH_SERVER_INTROSPECTION_ENDPOINT)
            .reply(200, introspectionResponse);

        const res = await request(app)
            .get("/$export?_since=2019-04-20")
            .set("content-type", "application/json")
            .set("authorization", `Bearer ${rpt}`);
        
        expect(res.status).toEqual(403);
    });

    it("happy path", async () => {
        const rpt = "GOOD_RPT";

        MOCK_AUTH_SERVER
            .post(AUTH_SERVER_INTROSPECTION_ENDPOINT)
            .reply(200, INTROSPECTION_RESPONSE_TEMPLATE);
        
        MOCK_FHIR_SERVER
            .get("/$export?_since=2019-04-20&_typeFilter=*%3F_security%3Anot%3DR")
            .reply(202, "");

        const res = await request(app)
            .get("/$export?_since=2019-04-20")
            .set("content-type", "application/json")
            .set("authorization", `Bearer ${rpt}`);
                    
        expect(res.status).toEqual(202);
    });
});


describe ("proper adjustment of client query based on client's scopes", () => {
    it("properly adjusts the path for wildcard resources and denied label", () => {
        const path = "http://localhost:4000/fhir/$export?_since=2019-04-20";
        const url = new URL("http://localhost:4000" + BulkHandler.adjustRequestPath(path, PERMISSIONS_WILDCARD_GRANT_WITH_LABEL_EXCEPTIONS));
    
        expect(url.searchParams.get("_typeFilter")).toEqual("*?_security:not=R");
    });
    
    it("properly adjusts the path for specific grant and denied label", () => {
        const permissions = [
            {
                resource_set_id: {
                    patientId: "*",
                    resourceType: ["MedicationRequest"],
                    securityLabel: [
                        {
                            system: "http://terminology.hl7.org/ValueSet/v3-ConfidentialityClassification",
                            code: "N"
                        }
                    ]            
                },
                scopes: ["bulk-export"]
            },
            {
                resource_set_id: {
                    patientId: "*",
                    resourceType: "*",
                    securityLabel: [
                        {
                            system: "http://terminology.hl7.org/ValueSet/v3-ConfidentialityClassification",
                            code: "R"
                        }
                    ]
                },
                deny: true,
                scopes: ["bulk-export"]
            }
        ];
        const path = "http://localhost:4000/fhir/$export?_since=2019-04-20";
        const url = new URL("http://localhost:4000" + BulkHandler.adjustRequestPath(path, permissions));
        expect(url.searchParams.get("_typeFilter")).toEqual("MedicationRequest?_security=N,*?_security:not=R");
    });
    
    it("properly adjusts the path for specific grant with multiple labels", () => {
        const permissions = [
            {
                resource_set_id: {
                    patientId: "*",
                    resourceType: ["MedicationRequest"],
                    securityLabel: [
                        {
                            system: "http://terminology.hl7.org/ValueSet/v3-ConfidentialityClassification",
                            code: "N"
                        },
                        {
                            system: "http://terminology.hl7.org/ValueSet/v3-ConfidentialityClassification",
                            code: "R"
                        }
                    ]            
                },
                scopes: ["bulk-export"]
            }
        ];
        const path = "http://localhost:4000/fhir/$export?_since=2019-04-20";
        const url = new URL("http://localhost:4000" + BulkHandler.adjustRequestPath(path, permissions));
        expect(url.searchParams.get("_typeFilter")).toEqual("MedicationRequest?_security=N,R");
    });
});
