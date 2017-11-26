import {TimeStampedPermissions} from "../model/TimeStampedPermissions";
import {APIError} from "../model/APIError";
import {issued_rpts} from "./AuthorizationEndpoint";

import {Router, Request, Response, NextFunction} from "express";
import {request} from "http";


export class IntrospectionEndpoint {
  router: Router;

  constructor() {
    this.router = Router();
    this.init();
  }

  public introspect(req: Request, res: Response, next: NextFunction): void {
    try {
        IntrospectionEndpoint.validateIntrospectionRequestParams(req.body);
        const token: string = req.body.token;
        const permissions: TimeStampedPermissions = issued_rpts [token];
        if (permissions && !permissions.isExpired()) {
            let introspectionResponseObject = {
                ...permissions,
                active: true
            };
            delete introspectionResponseObject.id;
            res.status(200)
            .send(introspectionResponseObject);
        } else {
            res.status(200)
            .send({active: false});
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

  private static validateIntrospectionRequestParams(object: any): void {
    if (object && object.token) {
      return;
    }
    throw new Error ("Bad Request. Expecting a ticket.");
  }

  private init(): void {
    this.router.post("/", this.introspect);
  }
}

export default new IntrospectionEndpoint();