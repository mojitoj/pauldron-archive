# Pauldron Clients
Pauldron Clients provides functions to faciliate connecting with the Pauldron services.

## Components

### Policy
The `get`, `add`, and `delete` functions mounted in the `Policy` object can be used for calling the respective policy endpoints. Here are some examples: 

```javascript
const PauldronClient = require("pauldron-client");
const policyId = await PauldronClient.Policy.add(
            POLICY, 
            POLICY_ENDPOINT_URI, 
            POLICY_ENDPOINT_API_KEY);
const policy = await PauldronClient.Policy.get(
            policyId,
            POLICY_ENDPOINT_URI, 
            POLICY_ENDPOINT_API_KEY);
await PauldronClient.Policy.delete(
            policyId,
            POLICY_ENDPOINT_URI, 
            POLICY_ENDPOINT_API_KEY);
```

### Permissions
The `register` function mounted in the `Permissions` object can be used to register a permission at the permission registration endpoint. Here is an example: 

```javascript
const PauldronClient = require("pauldron-client");

const permissions = [
	{
		resource_set_id: "res_id", 
		scopes: [
			{ key: "value1" }, 
			{ key: "value2" }
		]
	}
];
const ticket = await PauldronClient.Permissions.register(
            permissions,
            PERMISSION_ENDPOINT_URI`, 
            PROTECTION_ENDPOINT_API_KEY);
```
### RPT
The `get` and `introspect` functions mounted in the `RPT` object can be used for calling the respective  RPT endpoints. Here are some examples:

```javascript
const PauldronClient = require("pauldron-client");
const rpt = await PauldronClient.RPT.get(
			ticket,
			[
				{
				  	format: "jwt",
				    token: CLAIMS_TOKEN
				}
			], //note that this is an array and each claims token should have a format.
			AUTHORIZATION_ENDPOINT_URI, 
			AUTH_ENDPOINT_API_KEY);

const grantedPermissions = await PauldronClient.RPT.introspect(
            rpt,
            INTROSPECTION_ENDPOINT_URI, 
            PROTECTION_ENDPOINT_API_KEY);
```

### OAuth2 Token
The `get` and `introspect` functions mounted in the `OAuth2Token` object can be used to calling the respective  OAuth2 Token endpoints. Here are some examples:

```javascript
const PauldronClient = require("pauldron-client");

const permissions = [
	{
		resource_set_id: "res_id", 
		scopes: [
			{ key: "value1" }, 
			{ key: "value2" }
		]
	}
];

const token = await PauldronClient.OAuth2Token.get(
			permissions,
			CLAIMS_TOKEN, //note that this is a single JWT token and not an array. 
			OAUTH2_AUTHORIZATION_ENDPOINT_URI, 
			AUTH_ENDPOINT_API_KEY);

const grantedPermissions = await PauldronClient.OAuth2Token.introspect(
			token,
			INTROSPECTION_ENDPOINT_URI, 
			PROTECTION_ENDPOINT_API_KEY);
```

### HTTP Client
This is a wrapper around the `request` library which enables a client to communicate with a resource server protected by Pauldron with minimal effort. The client needs to provide the required information to obtain authrorization, i.e. the requested scopes, a JWT claims token, the URL for the OAuth2 authorization endpoint, and the suitable API key for communicating with the this authorization endpoint. Note that this client is currently implemented only for the OAuth2 interface. The client wrapper will request a fresh OAuth2 Token and includes it in the request to the resource server, if a a Token is not provided or in case it has expired. It, then, returns the Token and the response from the resource server. Here is an example:

```javascript
const PauldronClient = require("pauldron-client");

const permissions = [
	{
		resource_set_id: "res_id", 
		scopes: [
			{ key: "value1" }, 
			{ key: "value2" }
		]
	}
];

const options = {
	requestedScopes: permissions,
	claimsToken: CLAIMS_TOKEN, //note that this is a single JWT token and not an array. 
	authEndpointUrl: OAUTH2_AUTHORIZATION_ENDPOINT_URI,
	authApiKey: AUTH_ENDPOINT_API_KEY,
	method: "GET",
	json: true,
	uri: RESOURCE_SERVER_URL
};

const {token, response} = await PauldronClient.HTTP.OAuth2.request(options);
```


### 

## License
MIT
