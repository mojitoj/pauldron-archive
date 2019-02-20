const SimplePolicyDecisionCombinerEngine = require("../SimplePolicyDecisionCombinerEngine");

describe("the simple decision combiner engine" , () => {
    it ("must be able to combine auth decisions correctly." , () => {
        const decisions = [
            {
                authorization: "Deny",
                obligations:[]
            },
            {
                authorization: "Permit",
                obligations:[]
            },
            {
                authorization: "NotApplicable",
                obligations:[]
            }
        ];
        expect(SimplePolicyDecisionCombinerEngine.combineDecisionsDenyOverrides(decisions))
            .toMatchObject(
                {
                    authorization: "Deny",
                    obligations: {}
                }
        );
    });

    it ("must be able to combine obligations correctly." , () => {
        const decisions = [
            {
                authorization: "Permit",
                obligations:[{x: "x"}, {y: "y"}]
            },
            {
                authorization: "Permit",
                obligations:[{z: "z"}]
            },
            {
                authorization: "Permit",
                obligations:[]
            },
            {
                authorization: "NotApplicable",
                obligations:[]
            }
        ];
        
        expect(SimplePolicyDecisionCombinerEngine.combineDecisionsDenyOverrides(decisions))
            .toMatchObject(
                {
                    authorization: "Permit",
                    obligations: {x: "x", y: "y", z: "z"}
                }
        );
    });
});