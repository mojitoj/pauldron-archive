const jwt = require("jsonwebtoken");

const ClaimIssuers = require("../lib/claims-issuers");

function parse(claimsString) {
    const claimChunks = claimsString.split(".", 3);
    if (claimChunks.length !== 3) {
      throw {
        error: "claims_error",
        message: "Submitted claim token not in JWT format."
      };
    }
    let payload = {};
    try {
      payload = JSON.parse(Buffer.from(claimChunks[1], "base64").toString());
    } catch (e) {
      throw {
        error: "claims_error",
        message: `Malformed claims token: ${e.message}`
      }; 
    }
    const issuer = payload.iss;
    if (!issuer) {
      throw {
        error: "claims_error",
        message: "Submitted claims must have 'iss'."
      };
    }
    const key = ClaimIssuers.keyOf(issuer);
    if (!key) {
      throw {
        error: "claims_error",
        message: `Unknown issuer ${issuer}.`
      };
    }

    try {
      return jwt.verify(claimsString, key);
    } catch (e) {
      throw {
        error: "claims_error",
        message: `Invalid calims token: ${e.message}.`
      };
    }
}

module.exports = {
  parse
}
