import {Permission} from "../model/Permission";
import {TimeStampedPermissions} from "../model/TimeStampedPermissions";
import {APIError} from "../model/APIError";
import {registered_permissions} from "./PermissionEndpoint";
import {Router, Request, Response, NextFunction} from "express";
import {request} from "http";
import { ClaimsError, ValidationError, InvalidTicketError, ExpiredTicketError, NotAuthorizedByPolicyError, UMARedirect, UMARedirectError, UMAIntrospectionError } from "../model/Exceptions";
import { inspect } from "util";
import * as jwt from "jsonwebtoken";
import { PolicyDecision, AuthorizationDecision, Obligations, SimplePolicyDecisionCombinerEngine, PolicyEngine, Claims, Policy } from "pauldron-policy";
import { policyTypeToEnginesMap} from "./PolicyEndpoint";
import * as rp from "request-promise";
import { UMAServerInfo } from "../model/UMAServerInfo";

const config = require("../config.json");

export const UMA_REDIRECT_OBLIGATION_ID = "UMA_REDIRECT";
export const DENY_SCOPES_OBLIGATION_ID = "DENY_SCOPES";
export let issued_rpts: { [rpt: string]: TimeStampedPermissions } = {};

export class UMAClaimToken {
  format: string;
  token: string;
  info: any;
}

export class AuthorizationEndpoint {
  router: Router;

  constructor() {
    this.router = Router();
    this.init();
  }

  public async createANewOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const policies = req.app.locals.policies;
        AuthorizationEndpoint.validateRPTRequestParams(req.body);
        const ticket: string = req.body.ticket;
        const claimsTokens: UMAClaimToken[] = req.body.claim_tokens;
        const claims: Claims = await AuthorizationEndpoint.parseAndValidateClaimTokens(claimsTokens);

        const permissions: TimeStampedPermissions = registered_permissions[ticket];
        AuthorizationEndpoint.validatePermissions(permissions);

        // const claimsAndOtherAssertions = await AuthorizationEndpoint.augmentClaims(claims, req.body);
        const permissionsAfterReconciliationWithPolicies = await AuthorizationEndpoint
            .checkPolicies(claims, permissions.permissions, policies);

        const rpt: TimeStampedPermissions = TimeStampedPermissions.issue(config.uma.authorization.rpt.ttl, permissionsAfterReconciliationWithPolicies);

        issued_rpts[rpt.id] = rpt;
        res.status(201).send({rpt: rpt.id});
        delete registered_permissions[ticket];
    } catch (e) {
      if (e instanceof ValidationError) {
        res.status(400).send(
            new APIError(`Missing parameter: ${e.message}: ${req}`,
            "MissingParameter",
            400
         ));
      } else if (e instanceof ClaimsError) {
        res.status(403).send(
            new APIError(`Invalid or insufficient claims token: ${e.message}.`,
            "need_info",
            403
          ));
      } else if (e instanceof NotAuthorizedByPolicyError) {
        res.status(403).send(
          new APIError("Denied per authorization policies.",
          "not_authorized",
          403
        ));
      } else if (e instanceof UMAIntrospectionError) {
        console.log(e);
        res.status(403)
        .send(
          new APIError(`Failed at introspecting an RPT: ${e.message}`,
          "not_authorized",
          403
        ));
      } else if (e instanceof UMARedirectError) {
        res.status(403)
        .send(
          new APIError(`Need approval from ${e.umaServerParams.uri} but failed at communicating with this server.`,
          "need_info",
          403
        ));
      } else if (e instanceof UMARedirect) {
        res.status(401)
        .set("WWW-Authenticate", `UMA realm=\"${e.umaServerParams.realm}\", as_uri=\"${e.umaServerParams.uri}\", ticket=\"${e.ticket}\"`)
        .send(
          new APIError(`Need approval from ${e.umaServerParams.uri}.`,
          "uma_redirect",
          401,
          {"server": e.umaServerParams}
        ));
      } else if (e instanceof InvalidTicketError) {
        res.status(400).send(
          new APIError("Ticket is invalid.",
          "invalid_ticket",
          400
        ));
      } else if (e instanceof ExpiredTicketError) {
        res.status(400).send(
          new APIError("Ticket has expired.",
          "expired_ticket",
          400
        ));
      } else {
        console.log(e);
        res.status(500).send(
          new APIError("Internal server error.",
          "internal_error",
          500
        ));
      }
    }
  }
  // private static async augmentClaims(claims: Claims, otherStuff: any): Promise<Claims> {
  //   let claimsAndOtherAssertions = {
  //     rpts: (otherStuff.rpts || {}),
  //     ...claims
  //   };

  //   if (otherStuff.rpts) {
  //     for (const serverURI in otherStuff.rpts) {
  //          const introspectedPermissions = await AuthorizationEndpoint.introspectRPT(otherStuff.rpts[serverURI].server, otherStuff.rpts[serverURI].rpt);
  //          claimsAndOtherAssertions["rpts"][serverURI] = introspectedPermissions;
  //     }
  //   }
  //   return claimsAndOtherAssertions;
  // }

  private static async checkPolicies(claims: Claims, permissions: Permission[], policies: { [id: string]: Policy }): Promise<Permission[]> {
    const policyArray: Policy[] = Object.keys(policies).map((id) => policies[id]);
    const decision = new SimplePolicyDecisionCombinerEngine().evaluate(claims, policyArray, policyTypeToEnginesMap);
    if (decision.authorization === AuthorizationDecision.Deny) {
      throw new NotAuthorizedByPolicyError();
    } else if (decision.authorization === AuthorizationDecision.NotApplicable) {
      // failing safe on Deny if no applicable policies were found. This could be a configuration setting.
      throw new NotAuthorizedByPolicyError();
    } else if (decision.authorization === AuthorizationDecision.Indeterminate) {
      let ticket: string = "";
      try {
        ticket = await AuthorizationEndpoint.registerUMAPermissions(decision.obligations[UMA_REDIRECT_OBLIGATION_ID] as UMAServerInfo, permissions);
      } catch (umaError) {
        const exception = new UMARedirectError(`Error in registering permissions with another UMA server: ${umaError.message}`);
        exception.umaServerParams = decision.obligations[UMA_REDIRECT_OBLIGATION_ID];
        throw exception;
      }
      const e = new UMARedirect();
      e.umaServerParams = decision.obligations[UMA_REDIRECT_OBLIGATION_ID];
      e.ticket = ticket;
      throw e;
    }
    // else if (decision.authorization === AuthorizationDecision.Permit):
    return AuthorizationEndpoint.reconcilePermissionsAndObligations(permissions, decision.obligations);
  }

  private static async registerUMAPermissions(server: UMAServerInfo, permissions: Permission[]): Promise<string> {
    const options = {
      method: "POST",
      json: true,
      uri: server.uri + server.permission_registration_endpoint,
      body: permissions
    };

    try {
      const response = await rp(options);
      if (! response.ticket) {
        throw new UMARedirectError(`No ticket was returned from ${server.uri + server.permission_registration_endpoint}.`);
      }
      return response.ticket;
    } catch (e) {
      throw new UMARedirectError(e.message);
    }
  }

  private static reconcilePermissionsAndObligations (permissions: Permission[], obligations: Obligations): Permission[] {
    const deniedScopes = obligations[DENY_SCOPES_OBLIGATION_ID];
    if (deniedScopes) {
      return permissions.map((permission) => (
        {
          resource_id: permission.resource_id,
          resource_scopes: (permission.resource_scopes || []).filter((scope) => (
            ! deniedScopes.includes(scope)
          ))
        }
      )).filter((permission) => (
        ((permission.resource_scopes.length || 0) !== 0)
      ));
    } else {
      return permissions;
    }
  }

  private static validateRPTRequestParams(object: any): void {
    if (!object) {
      throw new ValidationError ("Bad Request.");
    } else if (! object.ticket) {
      throw new ValidationError (`Bad Request. Expecting a ticket in ${JSON.stringify(object)}`);
    }
  }

  private static async introspectRPT(server: UMAServerInfo, rpt: string): Promise<Permission[]> {
    const options = {
      method: "POST",
      json: true,
      form: {
        token: rpt
      },
      uri: server.uri + server.introspection_endpoint
    };
    let response = null;
    try {
      response = await rp(options);
    } catch (e) {
      throw new UMAIntrospectionError(`Unsuccessful introspection from ${(server.uri || "<Empty>") + (server.introspection_endpoint || "<Empty>")}: ${e.message}`);
    }
    if (!response || !response.active || ! response.permissions) {
      throw new UMAIntrospectionError(`Unsuccessful introspection from ${(server.uri || "<Empty>") + (server.introspection_endpoint || "<Empty>")}.`);
    }
    return response.permissions;
  }

  private static async parseAndValidateClaimTokens(claimTokens: UMAClaimToken[]): Promise<Claims> {
    if (!claimTokens || claimTokens.length === 0) {
      throw new ClaimsError("No claim tokens submitted.");
    }
    let allClaims: Claims = {rpts: {}};
    for (let index = 0; index < claimTokens.length; index++) {
      const claimToken = claimTokens [index];
      if (claimToken.format === "jwt") {
        allClaims = {
          ...AuthorizationEndpoint.parseJWTClaimToken(claimToken.token),
          ...allClaims
        };
      } else if (claimToken.format === "rpt") {
        const rpt = claimToken.token;
        const serverInfo: UMAServerInfo = claimToken.info;
        if (!serverInfo || !serverInfo.introspection_endpoint) {
          throw new ClaimsError(`RPT claims must provide 'info.introspection_endpoint' to enable verificication.`);
        }

        const introspectedPermissions = await AuthorizationEndpoint.introspectRPT(serverInfo, rpt);

        allClaims.rpts = {
          ...allClaims.rpts,
          [serverInfo.uri]: introspectedPermissions
        };
      } else {
        throw new ClaimsError(`Unrecognized claim format '${claimToken.format}'.`);
      }
    }
    return allClaims;
  }

  private static parseJWTClaimToken(claimsString: string): Claims {
    const claimChunks: string[] = claimsString.split(".", 3);
    if (claimChunks.length !== 3) {
      throw new ClaimsError("Submitted claim token not in JWT format.");
    }
    let payload: Claims = {};
    try {
      payload = JSON.parse(new Buffer(claimChunks[1], "base64").toString());
    } catch (e) {
      throw new ClaimsError(`Malformed claims token: ${e.message}`);
    }
    const issuer: string = payload.iss;
    if (!issuer) {
      throw new ClaimsError("Submitted claims must have 'iss'.");
    }
    const key = config.uma.authorization.claimsIssuerKeys[issuer];
    if (!key) {
      throw new ClaimsError(`Unknown issuer ${issuer}.`);
    }
    let claimsPayload: object = {};
    try {
      claimsPayload = jwt.verify(claimsString, key) as object;
    } catch (e) {
      throw new ClaimsError(`Invalid calims token: ${e.message}.`);
    }
    return payload;
  }

  private static validatePermissions(permissions: TimeStampedPermissions): void {
    if (!permissions) {
      throw new InvalidTicketError();
    } else if (permissions.isExpired()) {
      throw new ExpiredTicketError();
    }
  }

  private init(): void {
    this.router.post("/", this.createANewOne);
  }
}