
const UPSTREAM_SERVERS_PROTECTION_API_KEYS = JSON.parse(process.env.UPSTREAM_SERVERS_PROTECTION_API_KEYS || "{}");

function protectionAPITokenFor(serverId) {
    return UPSTREAM_SERVERS_PROTECTION_API_KEYS[serverId];    
}

module.exports={
    protectionAPITokenFor
};
