const superagent = require("superagent");

const _ = require("lodash");
const { genericErrorHandler } = require("./ErrorHandler");

async function registerPermissions(permissions, url, apiKey) {
  try {
    const httpResponse = await superagent
      .post(url)
      .type("json")
      .set("Authorization", `Bearer ${apiKey}`)
      .set("Accept", "application/json")
      .send(permissions);
    const response = httpResponse.body;
    if (!response.ticket) {
      throw {
        error: "permission_registration_error",
        message: `No ticket was returned from ${url}`
      };
    }
    return response.ticket;
  } catch (e) {
    throw {
      error: "permission_registration_error",
      message: `Failed registration at ${url}: ${e.message}`,
      cause: e
    };
  }
}

async function introspectRPT(rpt, url, apiKey) {
  let response = null;
  try {
    const httpResponse = await superagent
      .post(url)
      .type("form")
      .set("Authorization", `Bearer ${apiKey}`)
      .set("Accept", "application/json")
      .send({
        token: rpt
      });
    response = httpResponse.body;
  } catch (e) {
    throw {
      error: "introspection_error",
      message: `Failed at introspection from ${url}: ${e.message}`,
      cause: e
    };
  }
  if (!response) {
    throw {
      error: "introspection_error",
      message: `Failed at introspection from ${url}: Invalid response.`
    };
  } else if (!response.active || !response.permissions) {
    throw {
      error: "invalid_rpt",
      message: `Invalid RPT.`
    };
  }
  return response.permissions;
}

async function getRPT(ticket, claimTokens, url, apiKey) {
  let response = null;
  try {
    const httpResponse = await superagent
      .post(url)
      .type("json")
      .set("Authorization", `Bearer ${apiKey}`)
      .set("Accept", "application/json")
      .send({
        ticket: ticket,
        claim_tokens: claimTokens
      });
    response = httpResponse.body;
  } catch (e) {
    throw {
      error: "get_rpt_error",
      message: `Failed at requesting RPT from ${url}: ${e.message}`,
      cause: e
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
  let response = null;
  try {
    const httpResponse = await superagent
      .post(url)
      .type("form")
      .set("Authorization", `Bearer ${apiKey}`)
      .set("Accept", "application/json")
      .send({
        client_assertion_type:
          "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        grant_type: "client_credentials",
        client_assertion: claimsToken,
        scope
      });
    response = httpResponse.body;
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
  let response = null;
  try {
    const httpResponse = await superagent
      .post(url)
      .type("json")
      .set("Authorization", `Bearer ${apiKey}`)
      .set("Accept", "application/json")
      .send(policy);
    response = httpResponse.body;
  } catch (e) {
    throw {
      error: "add_policy_error",
      message: `Failed to add policy to ${url}: ${e.message}`,
      cause: e
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
  try {
    const httpResponse = await superagent
      .delete(`${url}/${policyId}`)
      .type("json")
      .set({ Authorization: `Bearer ${apiKey}` });
  } catch (e) {
    throw {
      error: "delete_policy_error",
      message: `Failed to delete policy at ${url}/${policyId}: ${e.message}`,
      cause: e
    };
  }
}

async function getPolicy(policyId, url, apiKey) {
  let response = null;
  try {
    const httpResponse = await superagent
      .get(`${url}/${policyId}`)
      .set("Authorization", `Bearer ${apiKey}`)
      .set("Accept", "application/json");
    response = httpResponse.body;
  } catch (e) {
    throw {
      error: "get_policy_error",
      message: `Failed to delete policy at ${url}/${policyId}: ${e.message}`,
      cause: e
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

function getSuperAgentFunction(options) {
  const httpVerb = options.method ? options.method.toLowerCase() : "";
  const uri = options.uri;
  const headers = options.headers;
  const body = options.body;
  const form = options.form;
  const qs = options.qs;
  if (httpVerb === "get" && !qs) {
    return superagent.get(uri).set(headers);
  } else if (httpVerb === "get" && qs) {
    return superagent.get(uri).set(headers).query(qs);
  } else if (httpVerb === "post" && !form) {
    return superagent.post(uri).set(headers).send(body);
  } else if (httpVerb === "post" && form) {
    return superagent.post(uri).type("form").set(headers).send(form);
  } else if (httpVerb === "delete") {
    return superagent.delete(uri).set(headers);
  } else {
    throw {
      error: "internal_error",
      message: `invalid HTTP verb: ${verb}`
    };
  }
}

async function httpRequestOAuth2(options) {
  let newOptions = options;
  let newToken = options.token;

  const { requestedScopes, claimsToken, authEndpointUrl, authApiKey } = options;

  try {
    newToken =
      newToken ||
      (await getOAuth2Token(
        requestedScopes,
        claimsToken,
        authEndpointUrl,
        authApiKey
      ));

    newOptions = _.set(
      options,
      "headers['Authorization']",
      `Bearer ${newToken}`
    );
    const response = await getSuperAgentFunction(newOptions);
    return {
      token: newToken,
      response: response.body
    };
  } catch (e) {
    if (e.status === 401) {
      newToken = await getOAuth2Token(
        requestedScopes,
        claimsToken,
        authEndpointUrl,
        authApiKey
      );
      newOptions = _.set(
        options,
        "headers['Authorization']",
        `Bearer ${newToken}`
      );
      const secondResponse = await getSuperAgentFunction(newOptions);
      return {
        token: newToken,
        response: secondResponse.body
      };
    }
    throw e;
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

const OAuth2Token = {
  get: getOAuth2Token,
  introspect: introspectRPT
};

const HTTP = {
  OAuth2: {
    request: httpRequestOAuth2
  }
};

module.exports = {
  Policy,
  Permissions,
  RPT,
  OAuth2Token,
  HTTP
};
