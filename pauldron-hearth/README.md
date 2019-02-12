# Pauldron Hearth

Pauldron Hearth is an HTTP reverse proxy for enforcing authorization policies over a FHIR server using a Pauldron authorization server. 

Enabling authorization for a FHIR server often requires tweaking the FHIR server code to ensure suitable guards are in place. This can be both an administrative and technical challenge especially if the FHIR server is not developed by your organization. Pauldron Hearth enables adding  an authorization layer based on Pauldron to any existing FHIR server without requiring any modification of the FHIR server. All you need to do is to configure Pauldron Hearth by pointing it at your FHIR server and your Pauldron authorization server, disable public access to your FHIR server, and publish Pauldron Hearth's address as your FHIR base URL.

## Overview
The proxy mediates between requests sent by a client and responses sent back by the FHIR server and performs the following:

1. If the client request does not have a token, Hearth sends back an error response directing the client to obtain authorization. If UMA-mode is enabled, it will also call the permission registration endpoint of the Pauldron server to register a set of permissions which were implied by the request. 
2. If the client request includes a token, Hearth runs [Token Introspection](https://tools.ietf.org/html/rfc7662) with the Pauldron server to ensure that a) the token is valid and b) obtain the list of _granted scopes_ for that token. If the token is invalid it proceeds as discussed in (1).
3. If the token provided by the client is valid, Hearth compares the list of _granted scopes_ with the implied set of _required scopes_ by the client's request, and accordingly, either permits the full response, redacts resources for which the required scopes were not granted, or denies the request altogether if none of the required scopes for fulfilling the request are granted.

## Features
- Enforce authorization on `GET` requests based on the response contents.
- Support for wildcard and conjunctive grants in scopes.
- Support for negative (denied) scopes. 

Currently, inspecting other HTTP verbs is not supported and those requests will be simply passed on to the FHIR server.

## Scope/Permission Structure
Pauldron Hearth supports both UMA and OAuth 2.0 access tokens, issued by the respective endpoints of Pauldorn (see [here](https://github.com/mojitoholic/pauldron/blob/master/pauldron/README.md) for details). 

Note that there is some terminology confusions between UMA and OAuth 2.0 here. While in OAuth 2.0 the authorization service grants a set of `scopes` to the client, in UMA, the authorization service grants a set of `permission`s which have the following structure (which confusingly overloads the term _scope_):

```json
{
	"resource_set_id": "...",
	"scopes": "..."
}
```

As an extension to the specifications, instead of plain opaque strings Pauldron supports JSON scopes (see a discussion of this idea [here](https://medium.com/@jafarim/using-json-to-model-complex-oauth-scopes-fa8a054b2a28)), so to Pauldron, an UMA `permission` is just a complex JSON `scope` in the OAuth 2.0 sense, therefore, Pauldron supports these two types of structures transparently and interchangeably.

In order to remain compatible with both UMA and OAuth 2.0 access tokens, Pauldron Hearth uses a scope structure compatible with UMA, i.e. separating the scope structure into a `resource_set_id` and `scopes`. This is admittedly a bit confusing due to the overloading of the term scope, but it ensures that the structure remains consistent with UMA permissions.

Currently, the `resource_set_id` is structured as follows:

- `patientId`: the patient identifier (including `system` and `value`).
- `resourceType`: the type of resource.

The `scope` array must include elements of the following format:

- `action`: the requested action, e.g. `read`, `create`, `update`, or `delete`.
- `securityLabels`: an array of security labels each including a `system` and `code`. 

Here is an example:

```json
{
  "resource_set_id": {
    "patientId": {
      "system": "urn:official:id",
      "value": "10001"
    },
    "resourceType": "Specimen"
  },
  "scopes": [
    {
      "action": "read",
      "securityLabels": [
        {
          "system": "http://hl7.org/fhir/v3/Confidentiality",
          "code": "N"
        }
      ]
    }
  ]
}
```
When a request is received by the client, Pauldron-Hearth identifies the implied requested permissions by:

- Identifying the patient(s) whose information is the subject of the request. The patient identifier is chosen based on the priorities defined in the `DESIGNATED_PATIENT_ID_SYSTEMS` environment variable.
- Identifying the resource types affected by the request.
- Identifying the implied actions. This is currently identified naively based on the HTTP method but it will be improved in future, since for example a `POST` request can be used either for creating a resource or searching.
- Identify the security labels for each action-resource type. Only the security labels whose system is specified in the `DESIGNATED_SECURITY_LABEL_SYSTEMS` environment variable are included in the scope/permission construction.

### Requesting and Granting Scopes
When working in UMA mode, the client does not need to be aware of the scopes/permissions implied by its request or even know what their structure looks like. In UMA, the client's _attempts_ to access  triggers the resource server to identify and register the required permissions with the authorization server. This leads to issuing a _ticket_, as essentially the receipt for the registration of those permission, which the client can present at the time of requesting an access token. So, at no point the client has to deal with the details of the requested or granted scopes/permissions.

In the two-legged OAuth 2.0 mode, however, the client needs to present a set of requested scopes at the time of requesting an access token. This can be tricky if the client does not know about the details of the scopes and its own access rights according to the policies and it is almost impossible for the client to request for a precise set of scopes without that knowledge. In such cases, it is very helpful if the client can request a maximal approximation of what it believes will suffice for its requests and leave it up the authorization server to refine the granted scopes after consulting the applicable policies. This is why Pauldron allows _wildcards_ and _arrays_ in scopes and also enables the Pauldron server to refine such scopes with _negative_ scopes which _deny_ a specific pattern of access.

For example, if a client wants to access all observations and immunizations of a patient, it can request the following scope; note the use of an array in `resourceType` which implies a conjunction, and the wildcard in `securityLabels` which implied _any_:

```json
{
  "resource_set_id": {
    "patientId": {
      "system": "urn:official:id",
      "value": "10001"
    },
    "resourceType": ["Observations", "Immunization"]
  },
  "scopes": [
    {
      "action": "read",
      {
          "system": "http://hl7.org/fhir/v3/Confidentiality",
          "code": "R"
      }
    }
  ]
}
```
Now assume that there is a policy that denies access to any restricted resources for this client. The Pauldron server, after examining the policies, grants the requested scope, but adds the following _negative_ scope as well:

```json
{
  "deny": true,
  "resource_set_id": {
    "patientId": {
      "system": "urn:official:id",
      "value": "10001"
    },
    "resourceType": "*"
  },
  "scopes": [
    {
      "action": "read",
      "securityLabels": "*"
    }
  ]
}
```
Pauldron Hearth adjudicates these scopes based on the following rules:

- Access to any resources matching an explicitly denied scopes is declined.
- Access to any resources not matching any granted scopes is implicitly declined.
- Access to any resources matching an explicitly granted scope but not any explicitly denied scopes is permitted.

## Setup
Pauldron Hearth is written as a simple [`express`](https://expressjs.com) app which can be started by:

```
node pauldron-hearth/server.js
```
The following environment variables must be configured:

- `FHIR_SERVER_BASE`: The FHIR server's base URL. 
- `UMA_SERVER_BASE`: The base URL for the Pauldron authorization server.
- `UMA_SERVER_PROTECTION_API_KEY`: The API key for the protection endpoint for the Pauldron authorization server. This is necessary for running token introspection and for permission registration if UMA-mode is used.
- `UNPROTECTED_RESOURCE_TYPES`: A comma-separated list of FHIR resource types which are not subject to protection. Any resource of the types in this list will be completely exempt from the authorization protections. For example, `OperationOutcome` or `CapabilityStatement` must usually be in this list. 
- `DESIGNATED_PATIENT_ID_SYSTEMS`: Ordered, comma-separated list of patient identifier systems. Pauldron Hearth will pick the identifier system with the highest-priority in this list to construct the required scopes for the resources linked to that patient and look up for that patient on other servers (e.g. when the patient consent resides on another server). If no matching identifier system is found for a patient, the first identifier system in the array of patient identifiers will be picked. Note that if the Patient resource has no identifiers an authorization error will be returned.
- `UMA_SERVER_INTROSPECTION_ENDPOINT`: The introspection endpoint for the Pauldron server. If you have set up Pauldron server with default settings, set this to `/protection/introspection`.

### UMA Settings
If you're using UMA, the following environment variables must also be configured:

- `UMA_SERVER_PERMISSION_REGISTRATION_ENDPOINT`: The permission endpoint for the  Pauldron server. If you have set up Pauldron server with default settings, set this to `/protection/permissions`
- `UMA_SERVER_REALM`: This will be used as the value of the `realm` field in the UMA response to the client when the client is advised to obtain authorization from the Pauldron authorization endpoint.  
- `UMA_SERVER_AUTHORIZATION_ENDPOINT`: The authorization endpoint for the  Pauldron server. If you have set up Pauldron server with default settings, set this to `/authorization`. Note that Hearth does not make any calls to this endpoint and simply includes this value in the UMA response to the client when the client is advised to obtain authorization from the Pauldron authorization endpoint.

## Demo Server
There is a Pauldron Hearth demo server deployed [here](https://pauldron-hearth.herokuapp.com) which is configured to proxy the FHIR server at: [http://hapi.fhir.org/baseR4](http://hapi.fhir.org/baseR4)
