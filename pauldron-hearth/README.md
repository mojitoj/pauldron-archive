# Pauldron Hearth

Pauldron Hearth is an HTTP reverse proxy for enforcing authorization policies over a FHIR server using a Pauldron authorization server. 

Enabling authorization for a FHIR server often requires tweaking the FHIR server code to ensure suitable guards are in place. This can be both an administrative and technical challenge especially if the FHIR server is not developed by your organization. Pauldron Hearth enables adding  an authorization layer based on Pauldron to any existing FHIR server without requiring any modification of the FHIR server. All you need to do is to configure Pauldron Hearth by pointing it at your FHIR server and your Pauldron authorization server, disable public access to your FHIR server, and publish Pauldron Hearth's address as your FHIR base URL.

## Overview
The proxy mediates between requests sent by a client and responses sent back by the FHIR server and performs the following:

1. If the client request does not have a token, Hearth sends back an error response directing the client to obtain authorization. If UMA-mode is enabled, it will also call the permission registration endpoint of the Pauldron server to register a set of permissions which were implied by the request. 
2. If the client request includes a token, Hearth runs [Token Introspection](https://tools.ietf.org/html/rfc7662) with the Pauldron server to ensure that a) the token is valid and b) obtain the list of _granted scopes_ for that token. If the token is invalid it proceeds as discussed in (1).
3. If the token provided by the client is valid, Hearth compares the list of _granted scopes_ with the implied set of _required scopes_ by the client's request, and accordingly, either permits the full response, redacts resources for which the required scopes were not granted, or denies the request altogether if none of the required scopes scopes for fulfilling the request are granted.

## Features
- Enforce authorization on `GET` requests based on the response contents.

Currently, inspecting other HTTP verbs is not supported and those requests will be simply passed on to the FHIR server.  

## Setup
Pauldron Hearth is written as a simple [`express`](https://expressjs.com) app which can be started by:

```
node pauldron-hearth/server.js
```
The following environment variables must be configured:

- `FHIR_SERVER_BASE`: The FHIR server's base URL. 
- `UMA_SERVER_BASE`: The base URL for the Pauldron authorization server.
- `UMA_SERVER_PROTECTION_API_KEY`: The API key for the protection endpoint for the Pauldron authorization server. This is necessary for running token introspection and for permission registration if UMA-mode is used.
- `UNPROTECTED_RESOURCE_TYPES`: A comma-separated list of FHIR resource types which are not subject to protection. Any resource of the types in this list will be completely exempt from the authorization protections. For example, `OperationOutcome` must usually be in this list. 
- `DESIGNATED_PATIENT_ID_SYSTEMS`: Ordered, comma-separated list of patient identifier systems. Pauldron Hearth will pick the identifier system with the highest-priority in this list to construct the required scopes for the resources linked to that patient and look up for that patient on other servers (e.g. when the patient consent resides on another server). If no matching identifier system is found for a patient, the first identifier system in the array of patient identifiers will be picked. Note that if the Patient resource has no identifiers an authorization error will be returned.
- `UMA_SERVER_INTROSPECTION_ENDPOINT`: The introspection endpoint for the Pauldron server. If you have set up Pauldron server with default settings, set this to `/protection/introspection`.

### UMA Settings
If you're using UMA, the following environment variables must also be configured:

- `UMA_SERVER_PERMISSION_REGISTRATION_ENDPOINT`: The permission endpoint for the  Pauldron server. If you have set up Pauldron server with default settings, set this to `/protection/permissions`
- `UMA_SERVER_REALM`: This will be used as the value of the `realm` field in the UMA response to the client when the client is advised to obtain authorization from the Pauldron authorization endpoint.  
- `UMA_SERVER_AUTHORIZATION_ENDPOINT`: The authorization endpoint for the  Pauldron server. If you have set up Pauldron server with default settings, set this to `/authorization`. Note that Hearth does not make any calls to this endpoint and simply includes this value in the UMA response to the client when the client is advised to obtain authorization from the Pauldron authorization endpoint.

## Demo Server
There is a Pauldron Hearth demo server deployed [here](https://pauldron-hearth.herokuapp.com) which is configured to proxy the FHIR server at: [http://hapi.fhir.org/baseR4](http://hapi.fhir.org/baseR4)
