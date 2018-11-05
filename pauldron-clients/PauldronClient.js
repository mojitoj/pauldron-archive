const rp = require("request-promise");

// export class UMAServerInfo {
//     realm: string;
//     uri: string;
//     permission_endpoint: string;
//     introspection_endpoint: string;
// }

// export class Permission {
//     resource_set_id: any;
//     scopes: any[];
// }

// export class Policy {
//   type: string;
//   name: string;
//   content: any;
// }

// export class ClaimToken {
//   format: string;
//   token: any;
// }




async function registerPermissions(permissions, url, apiKey) {
  const options = {
    method: "POST",
    json: true,
    uri: url,
    headers: {"Authorization": `Bearer ${apiKey}`},
    body: permissions
  };

  try {
    const response = await rp(options);
    if (! response.ticket) {
      throw {
        error: "permission_registration_error",
        message: `No ticket was returned from ${url}`
      };
    }
    return response.ticket;
  } catch (e) {
    genericErrorHandler(e);
    throw {
      error: "permission_registration_error",
      message: `Failed registration at ${url}: ${e.message}`
    };
  }
}

async function introspectRPT(rpt, url, apiKey) {
  const options = {
    method: "POST",
    json: true,
    form: {
      token: rpt
    },
    headers: {"Authorization": `Bearer ${apiKey}`},
    uri: url
  };
  let response = null;
  try {
    response = await rp(options);
  } catch (e) {
    genericErrorHandler(e);
    throw {
      error: "introspection_error",
      message: `Failed at introspection from ${url}: ${e.message}`
    };
  }
  if (!response) {
    throw {
      error: "introspection_error",
      message: `Failed at introspection from ${url}: Invalid response.`
    };
  } else if (!response.active || ! response.permissions) {
    throw {
      error: "invalid_rpt",
      message: `Invalid RPT.`
    };
  }
  return response.permissions;
}

async function getRPT(ticket, claimTokens, url, apiKey) {
  const options = {
    method: "POST",
    json: true,
    body: {
      ticket: ticket,
      claim_tokens: claimTokens
    },
    headers: {"Authorization": `Bearer ${apiKey}`},
    uri: url
  };
  let response = null;
  try {
    response = await rp(options);
  } catch (e) {
    genericErrorHandler(e);
    throw {
      error: "get_rpt_error",
      message: `Failed at requesting RPT from ${url}: ${e.message}`
    };
  }
  if (!response || !response.rpt) {
    throw {
      error: "get_rpt_error",
      message: `Failed at requesting RPT from ${url}: Invalid response.`
    };
  }
  return response.rpt;
}

async function addPolicy(policy, url, apiKey) {
  const options = {
    method: "POST",
    json: true,
    body: policy,
    headers: {"Authorization": `Bearer ${apiKey}`},
    uri: url
  };
  let response = null;
  try {
    response = await rp(options);
  } catch (e) {
    genericErrorHandler(e);
    throw {
      error: "add_policy_error",
      message: `Failed to add policy to ${url}: ${e.message}`
    };
  }
  if (!response || !response.id) {
    throw {
      error: "add_policy_error",
      message: `Failed to add policy to ${url}: Invalid response.`
    };
  }
  return response.id;
}

async function deletePolicy(policyId, url, apiKey) {
  const options = {
    method: "DELETE",
    json: true,
    headers: {"Authorization": `Bearer ${apiKey}`},
    uri: `${url}/${policyId}`
  };
  let response = null;
  try {
    response = await rp(options);
  } catch (e) {
    genericErrorHandler(e);
    throw {
      error: "delete_policy_error",
      message: `Failed to delete policy at ${url}/${policyId}: ${e.message}`
    };
  }
}

async function getPolicy(policyId, url, apiKey) {
  const options = {
    method: "GET",
    json: true,
    headers: {"Authorization": `Bearer ${apiKey}`},
    uri: `${url}/${policyId}`
  };
  let response = null;
  try {
    response = await rp(options);
  } catch (e) {
    genericErrorHandler(e);
    throw {
      error: "get_policy_error",
      message: `Failed to delete policy at ${url}/${policyId}: ${e.message}`
    };
  }
  if (!response || !response.id) {
    throw {
      error: "get_policy_error",
      message: `Failed to get policy at ${url}/${policyId}: Invalid response.`
    };
  }
  return response;
}

function genericErrorHandler(e) {
  if (!e ) {
    throw {
      error: "invalid_response"
    };
  } else if (e.statusCode === 404) {
    throw {
      error: "object_not_found",
      message: e.message
    };
  } else if (e.statusCode === 403 || e.statusCode === 401) {
    throw {
      error: "authorization_error",
      message: e.message
    };
  }
}

const Policy = {
  add: addPolicy,
  get: getPolicy,
  delete: deletePolicy
};

const Permissions = {
  register: registerPermissions
};

const RPT = {
  get: getRPT,
  introspect: introspectRPT
};

module.exports = {
  Policy,
  Permissions,
  RPT
}
