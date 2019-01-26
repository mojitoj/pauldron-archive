const hash = require("object-hash");
const TimeStampedPermission = require("../model/TimeStampedPermission");


const DENY_SCOPES_OBLIGATION_ID = "DENY_SCOPES";

function reconcilePermissionsAndObligations (permissions, obligations) {
    const deniedScopes = obligations[DENY_SCOPES_OBLIGATION_ID];

    if (deniedScopes) {
        const grantedPermissions = permissions.map(
            (permission) => (
              {
                  resource_set_id: permission.resource_set_id,
                  scopes: (permission.scopes || []).filter(
                      (scope) => (! arrayDeepIncludes (deniedScopes, scope))
                  )
              }
        ));

      return grantedPermissions.filter((permission) => (
        ((permission.scopes.length || 0) !== 0)
      ));
    } else {
      return permissions;
    }
}

function validatePermissions(permissions, permissionType) {
    if (!permissions) {
      throw {
        error: `invalid_${permissionType}`,
      };
    } else if (TimeStampedPermission.isExpired(permissions)) {
      throw {
        error: `expired_${permissionType}`,
      };
    }
}

function arrayDeepIncludes(array, thing) {
    const arrayHashes = array.map((element) => (hash(element)));
    return arrayHashes.includes(hash(thing));
}

module.exports = {
    reconcilePermissionsAndObligations,
    validatePermissions
}
