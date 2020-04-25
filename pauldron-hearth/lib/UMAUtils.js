const PermissionDiscovery = require("./PermissionDiscovery");
const PermissionEvaluation = require("./PermissionEvaluation");
const RequestUtils = require("./RequestUtils");
const ErrorUtils = require("./ErrorUtils");

const httpMethodToAction = {
  GET: "read",
  DELETE: "delete"
};

async function processProtecetedResource(request, backendResponse) {
  const action = httpMethodToAction[request.method]; //todo: this logic must be improved; e.g. a post request could be a search therefore a read.
  const requiredPermissions = await PermissionDiscovery.getRequiredPermissions(
    backendResponse,
    action
  );
  let grantedPermissions = [];
  try {
    grantedPermissions = await RequestUtils.getGrantedPermissions(request);
    ensureSufficientPermissions(requiredPermissions, grantedPermissions);
  } catch (e) {
    if (e.error === "no_rpt") {
      throw await ErrorUtils.noRptException(requiredPermissions);
    } else if (e.error === "insufficient_scopes") {
      throw await ErrorUtils.insufficientScopesException(requiredPermissions);
    } else if (e.error === "invalid_rpt") {
      throw await ErrorUtils.invalidRptException(requiredPermissions);
    } else {
      throw e;
    }
  }
}

function ensureSufficientPermissions(required, granted) {
  const sufficientPermissions = PermissionEvaluation.evaluateRequestedScopesAgainstGrantedScopes(
    granted,
    required
  );

  if (!sufficientPermissions) {
    throw {
      error: "insufficient_scopes"
    };
  }
}

module.exports = {
  processProtecetedResource
};
