import {Permission} from "../model/Permission";
import {TimeStampedPermissions} from "../model/TimeStampedPermissions";
import {APIError} from "../model/APIError";
import {registered_permissions} from "./PermissionEndpoint";
import {config} from "../config";
import {Router, Request, Response, NextFunction} from "express";
import {request} from "http";

export let issued_rpts: { [rpt: string]: TimeStampedPermissions } = {};

export class AuthorizationEndpoint {
  router: Router;

  constructor() {
    this.router = Router();
    this.init();
  }

  public createANewOne(req: Request, res: Response, next: NextFunction): void {
    try {
        AuthorizationEndpoint.validateRPTRequestParams(req.body);
        const ticket: string = req.body.ticket;
        const claims: any = req.body.claim_tokens;
        if (!AuthorizationEndpoint.validateClaimsToken(claims)) {
          res.status(403)
          .send(
              new APIError("Invalid or insufficient claims token.",
              "need_info",
              403
            ));
        }
        const permissions: TimeStampedPermissions = registered_permissions [ticket];
        if (permissions && !permissions.isExpired()) {
            const rpt: TimeStampedPermissions = TimeStampedPermissions.issue(config.authorization.rpt.ttl, permissions.permissions);
            issued_rpts[rpt.id] = rpt;
            res.status(201)
            .send({rpt: rpt.id});
            delete registered_permissions[ticket];
        } else {
            res.status(400)
            .send(
              new APIError("Ticket not recognized.",
              "invalid_ticket",
              400
            ));
        }
    } catch (e) {
      res.status(400)
        .send(
          new APIError(e.message,
          "MissingParameter",
          400
        )
      );
    }
  }

  private static validateClaimsToken(claims: any): boolean {
    console.log(`claims: ${claims}`);
    if (!claims)
      return false;
    return true;
  }

  private static validateRPTRequestParams(object: any): void {
    if (object && object.ticket) {
      return;
    }
    throw new Error ("Bad Request. Expecting a ticket.");
  }

  private init(): void {
    this.router.post("/", this.createANewOne);
  }
}

export default new AuthorizationEndpoint();