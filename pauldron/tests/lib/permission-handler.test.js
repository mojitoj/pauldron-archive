const {reconcilePermissionsAndObligations} = require("../../lib/permission-handler");

describe("permissions", () => {
    it("properly removes a denied permission if it is explicitly requested.", () => {
        const requestedPermissions = [
            {
                resource_set_id: "test_res_id_1", 
                scopes: [
                    {
                        action: "read", 
                        labels: [
                            {
                                system: "Confidentiality",
                                code: "N"
                            },
                            {
                                system: "Confidentiality",
                                code: "R"
                            }
                        ]
                    }
                ]
            },
            {
                resource_set_id: "test_res_id_2", 
                scopes: [
                    {
                        action: "read", 
                        labels: [
                            {
                                system: "Confidentiality",
                                code: "R"
                            }
                        ]
                    }
                ]
            }
        ];
        const obligations = {
            DENY_SCOPES: [
                {
                    resource_set_id: "test_res_id_2", 
                    scopes: [
                        {
                            action: "read", 
                            labels: [
                                {
                                    system: "Confidentiality",
                                    code: "R"
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const result = reconcilePermissionsAndObligations(requestedPermissions, obligations);
        expect(result).toHaveLength(1);
        expect(result[0].resource_set_id).toEqual("test_res_id_1");
    });

    
});