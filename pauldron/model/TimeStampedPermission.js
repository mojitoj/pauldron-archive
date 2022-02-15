const { randomUUID } = require("crypto");

function isExpired(timeStampedPermissions) {
  return new Date().valueOf() > timeStampedPermissions.exp;
}

function issue(validityInSeconds, permissions, realm) {
  const now = new Date().valueOf();
  return {
    id: randomUUID(),
    iat: now,
    exp: now + validityInSeconds * 1000,
    realm,
    permissions: permissions instanceof Array ? permissions : [permissions]
  };
}

module.exports = {
  isExpired,
  issue
};
