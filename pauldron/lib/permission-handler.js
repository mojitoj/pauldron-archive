const TimeStampedPermission = require("../model/TimeStampedPermission");
const _ = require("lodash");


const DENY_SCOPES_OBLIGATION_ID = "DENY_SCOPES";

function reconcilePermissionsAndObligations (permissions, obligations) {
    const deniedPermissions = obligations[DENY_SCOPES_OBLIGATION_ID];

    const grantedPermissions = permissions.filter((permission)=>
      ! deniedPermissions.some((deniedPermission)=>
        _.isEqual(permission, deniedPermission)
      )
    );
    const explicitlyDeniedPermissions = deniedPermissions.filter((deniedPermission)=>
      ! permissions.some((permission) => 
        _.isEqual(permission, deniedPermission)
      )
    ).map(
      (explicitlyDeniedPermission) => (
          {
            ...explicitlyDeniedPermission, 
            deny: true
          }
        )
    );
  //todo: we can do better here by also removing any permission which fully 'matches' a denied permission pattern.
  return _.union(grantedPermissions, explicitlyDeniedPermissions);
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

module.exports = {
    reconcilePermissionsAndObligations,
    validatePermissions
}
