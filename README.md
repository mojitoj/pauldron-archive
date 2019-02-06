# Pauldron
Pauldron is an experimental authorization server based on [User-Managed Access (UMA)](https://docs.kantarainitiative.org/uma/ed/uma-core-2.0-01.html) profile of OAuth 2.0 and a number of additional components to facilitate using this server. This is an experimental server for the purpose of testing new ideas and extensions, so using it in a production environment is not advised at this time.

Pauldron is the name of the piece of armour which covers the shoulder and connects the body piece to the arm piece. Just like the armour piece, the goal of Pauldron is to protect and integrate.


## Components
Here are the components of Pauldron. More detailed documentation exists for each of these components in their own documentation in the respective directory. 

- [Pauldron Authorization Server](https://github.com/mojitoholic/pauldron/tree/master/pauldron): This is the main authorization server. 
- [Pauldron Hearth](https://github.com/mojitoholic/pauldron/tree/master/pauldron-hearth): A simple experimental reverse proxy for protecting access to a [FHIR](https://www.hl7.org/fhir) server using a Pauldron server. 
- [Pauldron Clients](https://github.com/mojitoholic/pauldron/tree/master/pauldron-clients): A simple  client library to facilitate communicating with different endpoints of a Pauldron server and sending requests to a Pauldron Hearth service.
- [Pauldron Policy](https://github.com/mojitoholic/pauldron/tree/master/pauldron-policy): An authorization policy engine based on simple JSON-based policies modelled after [XACML](http://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html).  

## Current Features
- **Two-Legged OAuth2 Endpoint**: This allows the Client to directly request a set of scopes (permissions) from the OAuth2 authorization endpoint by submitting a signed JWT including claims related to the client's identity and request context. This is an alternative to presenting a Ticket received from a Resource Server (resulting from Permission Registration). In cases where the client knows in advance the scopes (permissions) required to fulfill its request, this will allow a simpler flow where the Permission Registration and initial interaction with the Resource Server is skipped. 

- **Basic UMA**: Authorization, Permission Registration, and Introspection Endpoints. Note that Resource Registration is not implemented at this time.

### Extensions
The following extensions are currently implemented:

- **Cascaded Authorization**: The ability to require another UMA server's approval as a pre-requisite to the approval of this server. For an introduction to the idea of Cascaded Authorization see this HL7 [draft white paper](https://gforge.hl7.org/gf/project/security/docman/Security%20FHIR/FHIR%20Security%20Connectathon/Cascaded_Authorization-2018-01-15.pdf). The introspection response from the upstream Pauldron server is treated as a Claims Token and these claims can be referenced in the server's authorization policy to make authorization decisions. For more technical details, see [this post](https://medium.com/@jafarim/how-pauldron-implements-cascaded-authorization-2f8d6b5c57d).

- **Policy Endpoint**: An endpoint to dynamically add/remove authorization policies to determine the server's authorization decisions, i.e. whether to issue an Access Token, and if yes, with what scopes. The policy can use the claims provided by the Client as decision factors. 
Currently, the only accepted authorization policy format is simple JSON-based [Pauldron Policies](https://github.com/mojitoholic/pauldron/tree/master/pauldron-policy) which supports authorization decisions and obligations (to restrict scopes) based on Client claims.

- **JSON Scopes**: Unlike most existing UMA/OAuth 2.0 implementations, scopes and resource set IDs are not limited to plain strings and can be any JSON objects. This enables modelling complex scopes flexibly without having to encode them into strings based on custom grammar (for a discussion on this, see [this post](https://medium.com/@jafarim/using-json-to-model-complex-oauth-scopes-fa8a054b2a28)).

- **Multiple Isolated Realms**: All users, permissions, token/RPTs, and policies belong to isolated realms and the policies, permissions, and tokens from different realms are not visible to other realms. This means, for example, that introspection is only successful for a token/RPT if it belongs to the same realm as the requester, and policies are created, listed, and applied on a per-realm basis.


## Feature Roadmap

- **FHIR Consent**: Ability to process [FHIR Consents](https://www.hl7.org/fhir/consent.html) as policy so, for access to a patient's information, the patient's consent can determine, whether an Access Token is issued and what scopes are granted. This will be in the form of submitting a reference to a FHIR server where Consents are stored.

- **Other Types of Tokens for Client Authentication and Claims**: Currently, the only accepted types of Claims Tokens for the Client are JWTs from an issuer known to the Pauldron server via a shared secret key. Supporting asymmetrically-signed claims tokens, and more specific support for OpenID Connect and SAML tokens is upcoming. Later, I would also like to support blockchain-based claims token based on [Decentralized Identifiers (DID)](https://w3c-ccg.github.io/did-spec/#service-endpoints).

- **Privacy-Preserving Authorization**: Ability to leverage the Resource Set Registration Endpoint (currently not implemented) to use the Authorization Server as a discovery mechanism for Resource Servers. In this flow, the Client requests an Access Token with a specific set of Permissions from the Pauldron Server and in response, receives an Access Token together with a list of Resource Servers which host the resource sets requested by the Client. For an introduction to idea of Privacy Preserving Authorization see this HL7 [draft white paper](https://gforge.hl7.org/gf/project/security/docman/Security%20FHIR/FHIR%20Security%20Connectathon/Privacy_Preserving_Authorization-2018-01-15.pdf).

- **Augmented Resource Set Registration Endpoint**: A Resource Set Registration Endpoint with the `metadata` extension to record metadata Claims (Attributes) about the Resource Set. These attributes can then be referenced in the authorization policies of the Pauldron Server.

- **Other Types of Policies**: Ability to accept and process other types of policies at the policy endpoint such as [XACML](http://docs.oasis-open.org/xacml/3.0/xacml-3.0-core-spec-os-en.html) and [ODRL](https://www.w3.org/community/odrl).
   

## License
MIT
