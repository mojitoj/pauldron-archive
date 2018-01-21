# Pauldron
Pauldron is an experimental authorization management server based on User-Managed Access (UMA) profile of OAuth 2.0 with additional extensions. 
The current extensions are:

- **Cascaded Authorization**: the ability to require another UMA server's approval as a pre-requisite to the approval of this server.
- **Policy Endpoint**: An endpoint to dynamically add/remove authorization policies which will guide the server's decisions to issue an Access Token.   

## License
MIT