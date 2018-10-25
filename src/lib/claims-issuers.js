
const CLAIMS_ISSUER_KEYS = JSON.parse(process.env.CLAIMS_ISSUER_KEYS || "{}");

function keyOf(issuerId) {
    return CLAIMS_ISSUER_KEYS[issuerId];    
}

module.exports={
    keyOf
};
