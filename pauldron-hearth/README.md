# Pauldron Hearth

Pauldron Hearth is an HTTP reverse proxy for enforcing authorization policies over a FHIR server using a Pauldron authorization server. 

Enabling authorization for a FHIR server often requires tweaking the FHIR server code to ensure suitable guards are in place. This can be both an administrative and technical challenge especially if the FHIR server is not developed by your organization. Pauldron Hearth enables adding  an authorization layer based on Pauldron to any existing FHIR server without requiring any modification of the FHIR server. All you need to do is to configure Pauldron Hearth by pointing it at your FHIR server and your Pauldron authorization server, disable public access to your FHIR server, and publish Pauldron Hearth's address as your FHIR base URL.

## Overview
The proxy mediates between requests sent by a client and responses sent back by the FHIR server and performs the following:

1. If the client request does not have a token, Hearth sends back an error response directing the client to obtain authorization. If UMA-mode is enabled, it will also call the permission registration endpoint of the Pauldron server to register a set of permissions which were implied by the request. 
2. If the client request includes a token, Hearth runs [Token Introspection](https://tools.ietf.org/html/rfc7662) with the Pauldron server to ensure that a) the token is valid and b) obtain the list of _granted scopes_ for that token. If the token is invalid it proceeds as discussed in (1).
3. If the token provided by the client is valid, Hearth compares the list of _granted scopes_ with the implied set of _required scopes_ by the client's request, and accordingly, either permits the full response, redacts resources for which the required scopes were not granted, or denies the request altogether if none of the required scopes for fulfilling the request are granted.

## Features
- Authorization on `GET` requests based on the response contents. (Currently, inspecting other HTTP verbs is not supported and those requests will be simply passed on to the FHIR server.)
- Wildcard and conjunctive grants in scopes.
- Negative (denied) scopes.
- Authorization on bulk `$export` requests with automatic application of redaction filters on the client's request based on the client's granted security labels in its scopes.
- An optional, rudimentary FHIR labeling service, currently capable of:
  - Adding a default [confidentiality label](https://www.hl7.org/fhir/v3/ConfidentialityClassification/vs.html) to any outgoing resource otherwise already labeled, i.e., having an existing `meta.security` (except resources of types listed in the `NO_LABEL_RESOURCE_TYPES` environment variable).
  - Adding a confidentiality high-watermark label to outgoing bundles, based on their contents.
- Augmenting the backend FHIR Server `CapabilityStatement` (at `/metadata`) to add capabilities added by Pauldron Hearth. Currently, this includes:
  - Declaring support for the [FHIR DS4P IG](http://build.fhir.org/ig/HL7/fhir-security-label-ds4p/branches/master/index.html).
  - Declaring `OAuth` support as the security mechanism for the server's REST endpoint.
  - Declaring that the server only supports JSON in the `format` attribute.


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
- `securityLabel`: A security label (or an array thereof) composed of a `system` and `code` as defined by [FHIR](https://www.hl7.org/fhir/security-labels.html). 

The `scopes` array must include the requested action, e.g. `read`, `create`, `update`, or `delete`. Currently these are simple opaque strings.

Here is an example:

```json
{
  "resource_set_id": {
    "patientId": {
      "system": "urn:official:id",
      "value": "10001"
    },
    "resourceType": "Specimen",
    "securityLabel": [
        {
          "system": "http://hl7.org/fhir/v3/Confidentiality",
          "code": "N"
        }
    ]
  },
  "scopes": ["read"]
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

For example, if a client wants to access all observations and immunizations of a patient, it can request the following scope; note the use of an array in `resourceType` which implies a _any of_ the values in the arary, and the wildcard in `securityLabel` which implies _any_ value:

```json
{
  "resource_set_id": {
    "patientId": {
      "system": "urn:official:id",
      "value": "10001"
    },
    "resourceType": ["Observations", "Immunization"],
    "securityLabel": [
      {
          "system": "http://hl7.org/fhir/v3/Confidentiality",
          "code": "R"
      }
    ]
  },
  "scopes": ["read"]
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
    "resourceType": "*",
    "securityLabel": "*"
  },
  "scopes": ["read"]
}
```
Pauldron Hearth adjudicates these scopes based on the following rules:

- Access to any resources matching an explicitly denied scopes is declined.
- Access to any resources not matching any granted scopes is implicitly declined.
- Access to any resources matching an explicitly granted scope but not any explicitly denied scopes is permitted.

### Authorization and Redaction for Bulk Access
Support for enforcing authorization over bulk export requests is based on the [FHIR Bulk Data Transfer draft specifications](https://github.com/smart-on-fhir/fhir-bulk-data-docs/blob/master/export.md). Proper enforcement of redactions requires the server to support the `_typeFilter` parameter, including the experimental wildcard filters as proposed by [Hotaru Swarm](https://github.com/mojitoholic/hotaru-swarm).

The following features are currently supported:

- **Authorization:** Pauldron Hearth ensures that a client requesting bulk access has been granted suitable scopes for bulk access to the requested resource types to export. This is based on the scope structure discussed below. 
- **Redaction:** By adding filters to the client's bulk export request, Pauldron Hearth ensures that clients can only export resources with security labels to which they have been granted access. 

#### Bulk Export Scopes

Based on the general structure for Pauldron Hearth scopes, the scope structure for bulk access is similar to the following. This scope, for example, authorizes the client to request bulk export of `Specimen` resources labeled as normal (`N`):

```json
{
  "resource_set_id": {
  "patientId": "*",
  "resourceType": "Specimen",
  "securityLabel": [
    {
      "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
      "code": "N"
    }
   ]
  },
  "scopes": ["bulk-export"]
}
```
The general rules for bulk scopes are as the following:

- The `patientId` must be set to `*`.
- The `scopes` array must include `bulk-export`.
- The `resourceType` array must specify the resource types which the client can export. If the client is allowed to make blanket bulk export requests for all resource types, this must be set to `*`. 

Pauldron Hearth will allow the client request to go through if the client is authorized to make bulk export requests for the specified resources types. Any security-label restrictions stated in the `securityLabel` attribute is turned into filters which further narrow down the client's request.

As an example, consider the following scope array: 

```json
[
 {
   "resource_set_id": {
    "patientId": "*",
    "resourceType": "*",
    "securityLabel": "*"
   },
   "scopes": ["bulk-export"]
 },
 {
   "resource_set_id": {
     "patientId": "*",
     "resourceType": "*",
     "securityLabel": [
       {
         "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
         "code": "R"
       }
     ]
   },
   "deny": true,
   "scopes": ["bulk-export"]
 }
];
```
The first scope grants the client bulk export on any or all resource types with any security labels. The second scope restricts the first one by denying bulk export of any resource labeled as restricted (`R`). This can be a common case where the client asks Pauldron for maximum access, and in response, Pauldron adds some exceptions in the form of denied scopes based on policies.
 
When this client sends an export request, Pauldron Hearth permits the request but adds a filter to the request to omit any resources labeled as `R`, similar to the following:

```
/$export?_typeFilter=*%3F_security%3Anot%3DR
```
Note that the wildcard `_typeFilter` in this request is an extension to the Bulk Transfer draft specifications proposed by the [Hotaru Swarm](https://github.com/mojitoholic/hotaru-swarm) implementation.

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
- `DESIGNATED_SECURITY_LABEL_SYSTEMS`: Comma-separated list of security labeling systems which Pauldron Hearth should care about. Pauldron Hearth will include the labels from these systems in forming scopes/permissions implied by a request and expects scopes/permissions to be explicitly granted for these security labels by the client's access token.  
- `UMA_SERVER_INTROSPECTION_ENDPOINT`: The introspection endpoint for the Pauldron server. If you have set up Pauldron server with default settings, set this to `/protection/introspection`.

### UMA Settings
If you're using UMA, the following environment variables must also be configured:

- `UMA_SERVER_PERMISSION_REGISTRATION_ENDPOINT`: The permission endpoint for the  Pauldron server. If you have set up Pauldron server with default settings, set this to `/protection/permissions`
- `UMA_SERVER_REALM`: This will be used as the value of the `realm` field in the UMA response to the client when the client is advised to obtain authorization from the Pauldron authorization endpoint.  
- `UMA_SERVER_AUTHORIZATION_ENDPOINT`: The authorization endpoint for the  Pauldron server. If you have set up Pauldron server with default settings, set this to `/authorization`. Note that Hearth does not make any calls to this endpoint and simply includes this value in the UMA response to the client when the client is advised to obtain authorization from the Pauldron authorization endpoint.

### Labelin Service Settings
- `ENABLE_LABELING_SERVICE`: enables the labeling service if set to `true`.
- `ADD_DEFAULT_CONFIDENTIALITY_LABEL`: enables adding default confidentiality label to resources if set to `true`. This label is only assigned if the resource is already labeled, i.e., has an existing `meta.security` attribute.
- `DEFAULT_CONFIDENTIALITY_CODE`: the default confidentiality label to be added to otherwise labeled resources. If not provided, this will default to `M` (moderate).
- `NO_LABEL_RESOURCE_TYPES`: comma-separated list of resource types that are exempt from adding labeling service.
- `ADD_HIGHT_WATER_MARK`: enables adding high-watermark confidentiality label to outgoing bundles based on their resource content.

## Demo Server
There is a Pauldron Hearth demo server deployed [here](https://pauldron-hearth.herokuapp.com) which is configured to proxy the FHIR server at: [http://hapi.fhir.org/baseR4](http://hapi.fhir.org/baseR4)
