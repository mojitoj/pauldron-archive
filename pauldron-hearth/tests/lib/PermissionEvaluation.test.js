const PermissionEvaluation = require("../../lib/PermissionEvaluation");


it("exact match.", () => {
    const granted = [
        {
          resource_set_id: {
            patientId: {
              system: "urn:official:id",
              value: "10001"
            },
            resourceType: "Specimen"
          },
          scopes: [
            {
              system: "http://hl7.org/fhir/v3/Confidentiality",
              code: "N"
            }
          ]
        },
        {
            resource_set_id: {
              patientId: {
                system: "urn:official:id",
                value: "10001"
              },
              resourceType: "Immunization"
            },
            scopes: [
              {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "N"
              }
            ]
          }
      ];

    const required = [granted[0]];
    const result = PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(granted, required);
    
    expect(result).toEqual(true);
});

it("denied scope.", () => {
    const granted = [
        {
          resource_set_id: {
            patientId: {
              system: "urn:official:id",
              value: "10001"
            },
            resourceType: "Specimen"
          },
          scopes: [
            {
              system: "http://hl7.org/fhir/v3/Confidentiality",
              code: "N"
            }
          ],
          deny: true
        },
        {
            resource_set_id: {
              patientId: {
                system: "urn:official:id",
                value: "10001"
              },
              resourceType: "Immunization"
            },
            scopes: [
              {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "N"
              }
            ]
          }
      ];

    const required = [granted[0]];
    const result = PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(granted, required);
    
    expect(result).toEqual(false);
});

it("wildcard granted scope.", () => {
    
    const granted = [
        {
          resource_set_id: {
            patientId: {
              system: "urn:official:id",
              value: "10001"
            },
            resourceType: "*"
          },
          scopes: "*"
        }
      ];

    const required = [
        {
          resource_set_id: {
            patientId: {
              system: "urn:official:id",
              value: "10001"
            },
            resourceType: "Specimen"
          },
          scopes: [
            {
              system: "http://hl7.org/fhir/v3/Confidentiality",
              code: "R"
            }
          ]
        },
        {
            resource_set_id: {
              patientId: {
                system: "urn:official:id",
                value: "10001"
              },
              resourceType: "Immunization"
            },
            scopes: [
              {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "N"
              }
            ]
          }
      ];
    
    let result = PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(granted, required);
    expect(result).toEqual(true);
});

it("wildcard denied scope.", () => {
    const allNormalButNoRestricted = [
        {
          resource_set_id: {
            patientId: {
              system: "urn:official:id",
              value: "10001"
            },
            resourceType: "*"
          },
          scopes: [
            {
              system: "http://hl7.org/fhir/v3/Confidentiality",
              code: "N"
            }
          ]
        },
        {
            deny: true,
            resource_set_id: {
              patientId: {
                system: "urn:official:id",
                value: "10001"
              },
              resourceType: "*"
            },
            scopes: [
              {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "R"
              }
            ]
          }
      ];

    const requiredAllNormal = [
        {
          resource_set_id: {
            patientId: {
              system: "urn:official:id",
              value: "10001"
            },
            resourceType: "Specimen"
          },
          scopes: [
            {
              system: "http://hl7.org/fhir/v3/Confidentiality",
              code: "N"
            }
          ]
        },
        {
            resource_set_id: {
              patientId: {
                system: "urn:official:id",
                value: "10001"
              },
              resourceType: "Immunization"
            },
            scopes: [
              {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "N"
              }
            ]
          }
    ];
    
    let result= PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(allNormalButNoRestricted, requiredAllNormal);
    expect(result).toEqual(true);

    const someRestricted = [
        {
          resource_set_id: {
            patientId: {
              system: "urn:official:id",
              value: "10001"
            },
            resourceType: "Specimen"
          },
          scopes: [
            {
              system: "http://hl7.org/fhir/v3/Confidentiality",
              code: "N"
            }
          ]
        },
        {
            resource_set_id: {
              patientId: {
                system: "urn:official:id",
                value: "10001"
              },
              resourceType: "Immunization"
            },
            scopes: [
              {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "R"
              }
            ]
          }
    ];

    result= PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(allNormalButNoRestricted, someRestricted);
    expect(result).toEqual(false);

    const someRestrictedOnOneResourceType = [
        {
          resource_set_id: {
            patientId: {
              system: "urn:official:id",
              value: "10001"
            },
            resourceType: "Specimen"
          },
          scopes: [
            {
              system: "http://hl7.org/fhir/v3/Confidentiality",
              code: "N"
            },
            {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "R"
              }
          ]
        }
    ];

    result= PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(allNormalButNoRestricted, someRestrictedOnOneResourceType);
    expect(result).toEqual(false);
});

it("array match.", () => {
    const granted = [
        {
          resource_set_id: {
            patientId: {
              system: "urn:official:id",
              value: "10001"
            },
            resourceType: "Specimen"
          },
          scopes: [
            {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "N"
            },
            {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "R"
            }
          ]
        }
    ];

    const required = [
        {
          resource_set_id: {
            patientId: {
                system: "urn:official:id",
                value: "10001"
            },
            resourceType: "Specimen"
          },
          scopes: [
            {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "N"
            }
          ]
        }
    ];

    const result = PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(granted, required);
    
    expect(result).toEqual(true);
});

it("array match with single element.", () => {
    const granted = [
        {
          resource_set_id: {
            patientId: {
              system: "urn:official:id",
              value: "10001"
            },
            resourceType: ["Specimen", "Immunization"]
          },
          scopes: [
            {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "N"
            },
            {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "R"
            }
          ]
        }
    ];

    const required = [
        {
          resource_set_id: {
            patientId: {
                    system: "urn:official:id",
                    value: "10001"
                },
                resourceType: "Specimen"
            },
            scopes: {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "N"
            }
        }
    ];

    const result = PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(granted, required);
    
    expect(result).toEqual(true);
});

it("mix recursive array and wildcard match", () => {
    const granted = [
        {
          resource_set_id: {
            patientId: {
              system: "urn:official:id",
              value: "10001"
            },
            resourceType: ["Specimen", "Immunization"]
          },
          scopes: [
            {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "*"
            }
          ]
        },
        {
            deny: true,
            resource_set_id: {
              patientId: {
                system: "urn:official:id",
                value: "10001"
              },
              resourceType: "*"
            },
            scopes: [
              {
                  system: "http://hl7.org/fhir/v3/Confidentiality",
                  code: "R"
              }
            ]
        }
    ];

    let required = [
        {
          resource_set_id: {
            patientId: {
                    system: "urn:official:id",
                    value: "10001"
                },
                resourceType: "Specimen"
            },
            scopes: {
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "N"
            }
        }
    ];

    let result = PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(granted, required);
    expect(result).toEqual(true);

    required = [
        {
          resource_set_id: {
            patientId: {
                    system: "urn:official:id",
                    value: "10001"
                },
                resourceType: "Specimen"
            },
            scopes: [{
                system: "http://hl7.org/fhir/v3/Confidentiality",
                code: "R"
            }]
        }
    ];

    result = PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(granted, required);
    expect(result).toEqual(false);

});

