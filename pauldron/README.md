# Pauldron
Pauldron server is the main component of Pauldron which implements an authorization server based on  [User-Managed Access (UMA)](https://docs.kantarainitiative.org/uma/ed/uma-core-2.0-01.html) profile of OAuth 2.0. 

## Overview
The main functions supported by the Pauldron server are discussed in this section.

### Realms
Pauldron keeps policies, issued tickets, and access tokens into isolated realms. Each client belongs to a realm, based on the value of the required `realm` attribute in its API token, and tickets, access tokens, and policies in one realm are not visible to the clients in other realms. This feature enables Pauldron to serve different security domains and minimize the risk of interference. For example:

- A ticket issued based on a request in one realm cannot be used by a client in another realm to request for an access token.
- Token introspection is only possible if the client requesting introspection for an access token issued in the same realm as the client. Access tokens belonging to other realms than that of the requesting client are always introspected as `invalid`.
- A policy created by a client in one realm is only applicable to authorization requests in the same realm and will have no effects on other realms.  

### Controlling Access to the Endpoints
To keep things simple, access control to all of the server endpoints is based on manually issued JWTs signed by a symmetric key which is set in the environment variable `SECRET_KEY`. Each endpoint/HTTP verb has a different scope requirement, so JWTs can be issued flexibly to authorize communicating only with certain endpoints and for certain operations. This approach was chosen as a simpler alternative to using OAuth 2.0 tokens for endpoint authorization. 

For example, the following JWT payload authorizes `test-resource-server` to be a member of the realm `example-realm` and use the permission registration endpoint to create (`PERMS:C`) or list (`PERMS:L`) permissions in that realm, and the introspection endpoint, to retrieve (`INTR:R`) the introspection information about an issued access token in that realm.  

```json
{
  "uid": "test-resource-server",
  "realm": "example-realm",
  "scopes": [
    "INTR:R",
    "PERMS:C",
    "PERMS:L"
  ]
}
```
 
### Permission Registration Endpoint
This endpoint, residing at `/protection/permissions`, is used to register new permissions and obtain a ticket based on the UMA specifications. Tickets are automatically removed after they expire or after an access token is issued based on it. A `GET` request to this endpoint returns a list of all registered permission in that realm, i.e. all the permission registered by any client belonging to the same realm as the requester.

### Introspection Endpoint
This endpoint, residing at `/protection/introspection`, is an implementation of the [OAuth 2.0 Token Introspection specifications](https://tools.ietf.org/html/rfc7662). This endpoint provides introspection for both UMA and OAuth2 access token types supported at the moment. 

### UMA Authorization Endpoint
This endpoint, residing at `/authorization`, is used to acquire an access token by presenting an UMA ticket (resulting from permission registration) based on the UMA specifications. Alongside the ticket, the request must include an array of claim tokens to provide more information about the client and the context of access. 

Pauldron expands the specifications and requires the token `format` to be specified for each token as shown in the example below:

```json
{
   "ticket": "9a1b1f98-e216-11e8-9f32-f2801f1b9fd1",
   "claim_tokens": [
     {
        "format": "jwt",
        "token": "..."
     },
     {
        "format": "rpt",
        "token": "a3113d9e-e216-11e8-9f32-f2801f1b9fd1",
        "info": {
           "uri": "https://upstream-uma-server",
           "introspection_endpoint": "/introspection"
        }
     }
   ]
}
```
Currently, two types of claim tokens are supported: JWT tokens and UMA Requesting Party Tokens (RPT).

#### JWT Tokens
JWT tokens must be signed by an issuer known to the Pauldron server based on sharing a secret symmetric key with the Pauldron server. This is done via the environment variable `CLAIMS_ISSUER_KEYS` which should be set to a JSON object mapping issuer identifiers to their shared symmetric signing keys, e.g. `{"issuer1":"secret1", "issuer2":"secret2"}`. The JWT token payload must include the field `iss` so that the issuer can be identified. Here is an example of a JWT claim token payload:

```json
{
   "client_id": "the_client",
   "organization": "org1",
   "iss": "issuer1",
   "pous": [
      {
         "system": "http://hl7.org/fhir/v3/ActReason",
         "code": "TREAT"
      }
   ]
}
```

#### UMA Requesting Party Tokens (RPT)
An RPT issued by _another_ UMA server can be presented as a claims token to the authorization endpoint. Pauldron will introspect this token and if it's valid, will include the identifier of the issuer and the introspection results as additional claims to the authorization context. These claims, like other claims, can be referenced in the Pauldron's authorization policies in that realm to make authorization rules. 
This is the basis for implementing cascaded authorization as discussed further in the HL7 [draft white paper](https://gforge.hl7.org/gf/project/security/docman/Security%20FHIR/FHIR%20Security%20Connectathon/Cascaded_Authorization-2018-01-15.pdf). For more technical details, also see [this post](https://medium.com/@jafarim/how-pauldron-implements-cascaded-authorization-2f8d6b5c57d).

### OAuth2 Authorization Endpoint
This endpoint, residing at `/oauth2/authorization`, is an implementation of [Section 4.4.2](https://tools.ietf.org/html/rfc6749#section-4.4.2) of the OAuth 2.0 specification with client authentication based on [the JWT profile of OAuth 2.0](https://tools.ietf.org/html/rfc7523). In this flow, the client directly requests for a specific set of scopes and provides a JWT token to submit assertions about the client and the context of access to support its request. If successful, an access token is issued and returned in response. Based on the specifications, the request must be submitted as a form with content type set to `application/x-www-form-urlencoded`. The parameters in the request are as follows:

- `client_assertion_type`: According to the specifications the value must be set to `urn:ietf:params:oauth:client-assertion-type:jwt-bearer`.

- `grant_type`: According to the specifications the value must be set to `client_credentials`.

- `client_assertion`: A JWT claim token similar to the ones discussed above. Note that unlike the UMA authorization endpoint, the specifications only allow for a single JWT token to be submitted.

- `scope`: A JSON-encoded array of scopes (permissions) requested by the client. Note that this is a minor digression from the specifications, which call for space-delimited opaque scopes, in order to accommodate complex JSON scopes. 

### Policy Endpoints
These endpoints, residing at `/policies`, enable the basic operations for authorization policies that govern issuing access tokens in a realm. The format of a policy and supported policy types are discussed in the Pauldron Policy [documentation](https://github.com/mojitoholic/pauldron/tree/master/pauldron-policy).

- **Create**: Calling `POST /policies` with a new policy in the body leads to creating a new policy in the realm. If successful, an `HTTP 201` response will be returned which echos back the policy with an additional `id` attribute which bears the assigned identifier for the policy. Submitting a policy identical to an existing policy (based on their hash) will result in an `HTTP 200` response.  
- **Retrive**: By calling `GET /policies/{id}` a client can retrieve an existing policy based on its identifier.
- **Delete**: Calling `DELETE /policies/{id}` results in deleting an existing policy. 
- **List**: By calling `GET /policies` a client can receive an array including all the policies active in the realm.


## Setup
Pauldron server is an [`express`](https://expressjs.com) app which can be started by:

```
node pauldron/server.js
```
Running the server, or the tests, requires a [`redis`](https://redis.io/) service the address to which must be set via the `REDIS_URL` environment variable. Redis is used as key-value store to keeping  tickets, permissions, and policies.
Other environment variables to be configured are as the following:

- `CLAIMS_ISSUER_KEYS`: Trusted claim issuers' symmetric signing keys as discussed above. Any claim token submitted by a client whose `iss` cannot be found in this object will be deemed invalid.
- `PERMISSION_TICKET_TTL`: Time to live for issued UMA tickets. Tickets will be automatically removed after their expiry.
- `RPT_TTL`: Time to live for issued access tokens. Access tokens will be automatically removed after their expiry. 
- `UPSTREAM_SERVERS_PROTECTION_API_KEYS`: This is only required if cascaded authorization is used. The value must be a JSON object mapping upstream UMA server identifiers to the protection API key used for permission registration and token introspection with those servers. For example: `{"https://upstream-uma-server":"sample-api-key"}`.

## Demo Server
There is a Pauldron demo server deployed [here](https://pauldron.herokuapp.com).


## Change Log

### 0.1.0
- Multiple isolated realms.

### 0.0.3
- Two-legged OAuth 2.0 flow. 
- All components moved into yarn workspaces.

### 0.0.2 
- Move away from `TypeScript` and use plain `JavaScript`.
- Switch to `Jest` for tests and improve test coverage.
- Move all configurations to `.env`.
- Switch to using `redis` for storing tokens and policies.
- Various instances of refactoring.

### 0.0.1 
- Basic UMA Authorization, Permission Registration, and Introspection Endpoints.
- Policy Endpoint.
- Cascaded Authorization by specifying in the policy that the decision depends on submitting an Access Token from an upstream Pauldron server. The introspection result for that Access Token is treated as a claims token and its claims can be referenced in the policy. 
- JSON Resource Set ID and Scopes.  
- Policy Endpoint accepts policies in Pauldron Policy format.
- Authorization Endpoint accepts JWTs signed by an issuer known to the Pauldron Server via a shared secret key (in the Pauldron configuration file).
- Access control to all of the server endpoints is based on manually issued JWTs. Each endpoint/HTTP verb has a different scope requirement, so JWTs can be issued flexibly to authorize communicating with one endpoint and for one operation. 
   

## License
MIT
