# Pauldron Policy
Pauldron Policy is a Policy module developed for the [Pauldron Authorization Server](https://github.com/mojitoholic/pauldron). It can, however, be used on its own as a very simple authorizatino policy engine.

## Features
- Validate and query for authorization decisions against policies in the following format: 

	- Pauldron Simple Policy.
- A simple Policy Decision Combiner with a deny-override strategy which accumulates all the obligations from all the decisions.

## Concepts
In Pauldron, policies are evaluated against a simple key-value claims objects in which keys are strings and values can be any object. For example:

```json
{
  "client_id": "client_1"
};
```
The result of the evaluation is an object with two keys, `authorization` and `obligations`, respectively, representing the authorization decision and some obligations. The authorization decision can be `Permit`, `Deny`, `Indeterminate`, or `NotApplicable`. Obligations are encoded in the form of an object with keys representing the obligation identifier and the values representing the obligation parameters. For example:

```json
{
  "authorization" : "Indeterminate",
  "obligations": {
      "UMA_REDIRECT":{
        "realm":"Upstream UMA Server",
        "uri":"http://localhost:3001",
        "authroization_endpoint":"/authorization",
        "introspection_endpoint":"/protection/permissions","permission_registration_endpoint":"/protection/introspection"
      }
  }
}
```

Policies are JSON objects taking the following form:

- `type`: the policy type. 
- `name`: A string used as an identifier or explanation for the policy.
- `content`: The content of the policy.

## Pauldron Simple Policy

For Simple Pauldron polices, the `type` should be set to `pauldron:simple-policy`, and the `content` should be JSON object of the following form:

- `rules`: an object which maps a number of string rule IDs to rule objects (discussed below).  
- `default`: a `PolicyDecision` object indicating the default decision to be returned if the claims object does not match any of the rules in the policy. 

A rule object must have the following form:

- `name`: A string used as an identifier or explanation for the rule.
- `matchAnyOf`: An array of JSON objects. The rule will be activated if any of these objects _match_ the input claims, i.e. all the keys in the object also exist in the claims object and their values match.
- `decision`: the `PolicyDecision` object to return if the rule matches the claims object and the condition is satisfied. 

- `condition` (optional): an additional condition to be evaluated against the claims in order to consider the rule matched. The condition must be a JavaScript expression evaluated to a `boolean`. For evaluation, the variable names in this expression will be mapped to the keys in the claims object and their values are set to the value of the corresponding property in the claims object. A limited set of JavaScript functions and structures are allowed to appear in condition expressions. Check out [SimpleRule.js](https://github.com/mojitoholic/pauldron-policy/blob/master/src/SimpleRule.js) to browse some of the restrictions applied on the JavaScript code that can appear in a condition.

Check out the following sample policy as an example; it includes one rule and the default decision to deny with no obligation.

The rule will match any claims object which has a `client_id` key with the value `client4`. If the claims object also satisfies the condition, a decision to `Permit` is returned which also includes an one obligation.

The condition includes one varilable name `pous` whose value will be mapped to the propoerty with the same name from the claims object, if exists. This condition will be evaluated to true if:

- There is a `pous` property in the claims object whose value is an array.
- There is at least one object in that array wich has the following propoerties:
	- A property `system` with the value `http://hl7.org/fhir/v3/ActReason`
	- A property `code` with the value `TREAT`.

 
```json
{
  "type": "pauldron:simple-policy",
  "name": "policy1",
  "content": {
    "rules": {
      "rule1": {
        "name": "Permitted Clients Based on pou",
        "matchAnyOf":[
          {"client_id":"client4"}
        ],
        "decision": {
          "authorization": "Permit", 
          "obligations": {
            "DENY_SCOPES": [
              {
                "resource_set_id": "*", 
                "scopes": [
                    {
                        "action": "read", 
                        "labels": [
                            {
                                "system": "Confidentiality",
                                "code": "R"
                            }
                        ]
                    }
                ]
              }
            ]
          },
        "condition": 
          "pous.filter((pou)=>(pou.system==='http://hl7.org/fhir/v3/ActReason' && pou.code==='TREAT')).length>0"            
      },
    },
    "default": {
      "authorization": "Deny", 
      "obligations": {}
    }
}
```

## Usage
### Policy Verification
For policy verification, use the function `validate` in `SimplePolicy.js`. This will throw a suitable exception if the policy is not in the right format:

```javascript
const {SimplePolicy} = require("pauldron-policy");

try {
  result = SimplePolicy.validate(wrongPolicy);
} catch (e) {
  console.log (e.message);
}
```

### Authorization Query
For making an authorization query against a policy, call `evaluate` in `SimplePolicyEngine.js`:

```javascript
const {SimplePolicyEngine} = require("pauldron-policy");

const policy = require("tests/fixtures/simple-policy.json");
const claims = {
  client_id: "client2", 
  organization: "org1"
};
const decision = SimplePolicyEngine.evaluate(claims, policy);
```
Note that the `evaluate` method will apply a deny-override strategy if the evaluation of the rules in the policy result in conflicting decisions. 

### Combined Decisions
For making an authorization query against a set of policies, call `evaluate` in `SimplePolicyDecisionCombinerEngine.js` which provides a mechanism to evaluate a set of claims againt an array of policies with a deny-override-accumulate-obligations strategy. This function takes a policy-type-to-engine map in which keys are the policy type and values are an object including an `evalute()` returning a value decision. Note that this is to pave the road for future support of other policy types such as XACML. 

```javascript
const {SimplePolicyDecisionCombinerEngine, SimplePolicyEngine} = require("pauldron-policy");
const policyTypeToEnginesMap = {
    "pauldron:simple-policy": SimplePolicyEngine
};

const decision = SimplePolicyDecisionCombinerEngine.evaluate(
				claims,
				[policy1, policy2, policy3],
				policyTypeToEnginesMap);
```

## Installation
The library can be installed using `yarn` or `npm`:

```
$ yarn install pauldron-policy
```

## Changelog

### 0.2.3
- Move to a workspace within the Pauldron main repository.

### 0.2.2
- Fix issues with package exports.

### 0.2.0
- Move away from `TypeScript` and use plain `JavaScript`. 
- Switch to `jest` for tests.

### 0.1.0

- Pauldron Simple Policy validation and evaluation.
- A simple policy decision combiner engine with deny-override strategy.
