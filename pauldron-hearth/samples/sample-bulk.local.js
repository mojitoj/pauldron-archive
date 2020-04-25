
const jwt = require("jsonwebtoken");
const PauldronClient = require("pauldron-clients");


const POLICY_API_TOKEN = {
    uid: "test_user",
    realm: "example",
    scopes: ["POL:C", "POL:L", "POL:R", "POL:D"]
};

const AUTH_API_TOKEN = {
    uid: "test_user",
    realm: "example",
    scopes: ["AUTH:C"]
};

const TEST_POLICY_API_KEY = jwt.sign(POLICY_API_TOKEN, "secret");
const TEST_AUTH_API_KEY = jwt.sign(AUTH_API_TOKEN, "secret");

const POLICY = {
    type: "pauldron:simple-policy",
    name: "Organizational Policy1",
    content: {
        rules: {
            permittedClientsBasedOnPurpose: {
                name: "Permitted Clients Based on pou",
                matchAnyOf:[
                    {
                        client_id: "client4"
                    }
                ],
                decision: {
                    authorization: "Permit", 
                    obligations: {
                        DENY_SCOPES: [
                            {
                                resource_set_id: {
                                  patientId: "*",
                                  resourceType: "*",
                                  securityLabel: [
                                    {
                                      system: "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
                                      code: "R"
                                    }
                                  ]
                                },
                                deny: true,
                                scopes: ["bulk-export"]
                            }
                        ]
                    }
                },
                condition: "pous.filter((pou)=>(pou.system==='http://hl7.org/fhir/v3/ActReason' && pou.code==='TREAT')).length>0"            
            },
        },
        default: {
            authorization: "Deny", 
            obligations: {}
        }
    }
};


const CLAIMS = {
    client_id: "client4",
    organization: "org1",
    iss: "sampleIssuer1",
    pous: [
        {
            system: "http://hl7.org/fhir/v3/ActReason",
            code: "TREAT"
        }
    ]
};

const CLAIMS_TOKEN = jwt.sign(CLAIMS, "secret1");

const scopes = [
    {
        resource_set_id: {
            patientId:"*",
            resourceType: "*",
            securityLabel: "*"
        },
        scopes: ["bulk-export"]
    }
];

async function testWithHttpClientWrapper() { 
    const uri = process.argv[2];
    if (!uri) {
        console.error("Must provide a URL.");
        return;
    }

    await PauldronClient.Policy.add(
        POLICY, 
        "http://localhost:3000/policies", 
        TEST_POLICY_API_KEY
    );

    const options = {
        requestedScopes: scopes,
        claimsToken: CLAIMS_TOKEN,
        authEndpointUrl: "http://localhost:3000/oauth2/authorization",
        authApiKey: TEST_AUTH_API_KEY,
        method: "GET",
        json: true,
        uri: uri,
        resolveWithFullResponse: true
    };
    console.log(`${options.method} ${options.uri}`);
    const {token, response} = await PauldronClient.HTTP.OAuth2.request(options);

    console.log(`token: ${token}`);
    console.log(`response: ${JSON.stringify(response, null, 1)}`);
}


testWithHttpClientWrapper()
.then((res) => {})
.catch((e) => {
    console.log(e.message);
});
