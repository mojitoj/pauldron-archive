# Pauldron
Pauldron is an experimental authorization server based on [User-Managed Access (UMA)](https://docs.kantarainitiative.org/uma/ed/uma-core-2.0-01.html) profile of OAuth 2.0 with some additional extensions. 

This is an experimental server for the purpose of testing new ideas and extensions, so do not use it in a production environment. Note that, like the project itself, this documentation is a work in progress.

## Current Features

### Extensions
The following extensions are currently implemented:

- **Cascaded Authorization**: The ability to require another UMA server's approval as a pre-requisite to the approval of this server. For an introduction to the idea of Cascaded Authorization see this HL7 draft [white paper](https://gforge.hl7.org/gf/project/security/docman/Security%20FHIR/FHIR%20Security%20Connectathon/Cascaded_Authorization-2018-01-15.pdf). The introspection response from the upstream Pauldron server is treated as a Claims Token and these claims can be referenced in the server's authorization policy to make authorization decisions. 
- **Policy Endpoint**: An endpoint to dynamically add/remove authorization policies to determine the server's authorization decisions, i.e. whether to issue an Access Token, and if yes, with what scopes. The policy can use the claims provided by the Client as decision factors. 
Currently, the only accepted authorization policy format is simple JSON-based [Pauldron Policies](https://github.com/mojitoholic/pauldron-policy) which supports authorization decisions and obligations (to restrict scopes) based on Client claims.
- **JSON Scopes**: Unlike most existing UMA/OAuth 2.0 implementations, scopes and resource set IDs are not limited to plain strings and can be complex JSON objects. This enables modeling complex scopes flexibly without having to encode them into strings based on custom grammar (for a discussion on this, see [here](https://medium.com/@jafarim/using-json-to-model-complex-oauth-scopes-fa8a054b2a28)).
- **Compartmentalization of Resource Server based on Domains**: Resource Servers are grouped into Domains. A Resource Servers only gets a successful introspection response for an Access Token if it is issued based on a Ticket which has been originally issued at the request of a Resource Server belonging to the same Domain. Thus, if a Client receives a valid Access Token based on a Ticket from a Resource Server in one domain, and then presents this Access Token to a Resource Server belonging to another domain, the introspection will deem that Access Token invalid. For simplicity, when a Resource Server does not have a `domain` property set, it is assumed to belong to its own one-server domain with the domain ID being its `client_id`. 


### Other Features
- Basic Authorization, Permission Registration, and Introspection Endpoints.
- As Client Claims Tokens, the Authorization Endpoint accepts JWTs signed by an issuer known to the Pauldron Server via a shared secret key.
- Access control to all of the server endpoints is based on manually issued JWTs. Each endpoint/HTTP verb has a different scope requirement, so JWTs can be issued flexibly to authorize communicating with one endpoint and for one operation. This approach was chosen as a simpler alternative to using OAuth 2.0 tokens for endpoint authorization.


## Upcoming Features

- **FHIR Consent**: Ability to process FHIR Consents as the policy governing the issuing of Access Tokens. This will be in the form of submitting a reference to a FHIR server where Consents are stored.
- **Other Types of Tokens for Client Authentication and Claims**: Currently, the only accepted types of claims for the Client are JWTs from an issuer known to the Pauldron server via a shared secret key. Supporting asymmetrically-signed claims tokens, and more specific support for OpenID Connect and SAML tokens is upcoming. Later, I would also like to support blockchain-based claims token based on [Decentralized Identifiers (DID)](https://w3c-ccg.github.io/did-spec/#service-endpoints).
- **Two-Legged Mode**: Ability to let the Client directly request a set of Permissions from the Authorization Endpoint, instead of presenting a Ticket from a Resource Server (resulting from Permission Registration). This will allow a simpler flow where the Permission Registration and initial interaction with the Resource Server by the Client is eliminated. 
- **Privacy-Preserving Authorization**: Ability to leverage the Resource Set Registration Endpoint (currently not implemented) to use the Authorization Server as a discovery mechanism for Resource Servers. In this flow, the Client requests an Access Token with a specific set of Permissions from the Pauldron Server and in response, receives an Access Token together with a list of Resource Servers which host the resource sets requested by the Client. For an introduction to idea of Privacy Preserving Authorization see this HL7 draft [white paper](https://gforge.hl7.org/gf/project/security/docman/Security%20FHIR/FHIR%20Security%20Connectathon/Privacy_Preserving_Authorization-2018-01-15.pdf). 
- **Augmented Resource Set Registration Endpoint**: A Resource Set Registration Endpoint with the `metadata` extension to record metadata Claims (Attributes) about the Resource Set. These attributes can then be referenced in the authorization policies of the Pauldron Server.
- **XACML Policies**: Ability to accept and process [XACML](http://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html) policies at the Pauldron Policy Endpoint.
- **Persistent Key-Value Store**: For simplicity, all the data structures (tickets, access tokens, policies) are currently stored in memory. Moving to a persistent key-value store will be a future work.

## Other Pauldron Components
Aside from the main sever, there are a number of additional Pauldron components to facilitate its use:

- [Pauldron FHIR Proxy](https://github.com/mojitoholic/pauldron-fhir-proxy): A simple experimental reverse proxy for protecting access to a [FHIR](https://www.hl7.org/fhir) server using a Pauldron server. 
- [Pauldron Clients](https://github.com/mojitoholic/pauldron-clients): A set of simple client libraries to facilitate communicating with different endpoints of a Pauldron server.
- [Pauldron Policy](https://github.com/mojitoholic/pauldron-policy): A very simple JSON-based policy format for expressing authorization policies. 

## Change Log
### 0.0.1 
- Basic Authorization, Permission Registration, Introspection, and Policy Endpoints.
- Cascaded Authorization by specifying in the policy that the decision depends on submitting an Access Token from an upstream Pauldron server. The introspection result for that Access Token is treated as a claims token and its claims can be referenced in the policy. 
- JSON Resource Set ID and Scopes. 
- Resource Servers are grouped into Domains. A Resource Servers only gets a successful introspection response for an Access Token if it is issued based on a Ticket which has been originally issued at the request of a Resource Server belonging to the same Domain. Thus, if a Client receives a valid Access Token based on a Ticket from a Resource Server in one domain, and then presents this Access Token to a Resource Server belonging to another domain, the introspection will deem that Access Token invalid. For simplicity, when a Resource Server does not have a `domain` property set, it is assumed to belong to its own one-server domain with the domain ID being its `client_id`. 
- Policy Endpoint accepts policies in Pauldron Policy format.
- Authorization Endpoint accepts JWTs signed by an issuer known to the Pauldron Server via a shared secret key (in the Pauldron configuration file).
- Access control to all of the server endpoints is based on manually issued JWTs. Each endpoint/HTTP verb has a different scope requirement, so JWTs can be issued flexibly to authorize communicating with one endpoint and for one operation. 
   

## License
MIT