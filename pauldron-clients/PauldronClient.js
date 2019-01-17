const rp = require("request-promise");
const {genericErrorHandler} = require("./ErrorHandler");

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

async function getOAuth2Token(requestedScopes, claimsToken, url, apiKey) {
  const scope = JSON.stringify(requestedScopes);
  const options = {
    method: "POST",
    form: {
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      grant_type: "client_credentials",
      client_assertion: claimsToken,
      scope
    },
    json: true,
    headers: {"Authorization": `Bearer ${apiKey}`},
    uri: url
  };
  let response = null;
  try {
    response = await rp(options);
  } catch (e) {
    genericErrorHandler(e);
    throw {
      error: "get_oauth2_token_error",
      message: `Failed at requesting OAuth2 Token from ${url}: ${e.message}`
    };
  }
  if (!response || !response.token) {
    throw {
      error: "get_oauth2_token_error",
      message: `Failed at requesting OAuth2 Token from ${url}: Invalid response.`
    };
  }
  return response.token;
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

const OAuth2Token = {
  get: getOAuth2Token,
  introspect: introspectRPT
}

module.exports = {
  Policy,
  Permissions,
  RPT,
  OAuth2Token
}
