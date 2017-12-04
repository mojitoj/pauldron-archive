import {TimeStampedPermissions} from "../model/TimeStampedPermissions";
import {APIError} from "../model/APIError";
import {issued_rpts} from "./AuthorizationEndpoint";

import {Router, Request, Response, NextFunction} from "express";
import {request} from "http";
import { InvalidRPTError, ExpiredRPTError, ValidationError } from "../model/Exceptions";
import { inspect } from "util";


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
        IntrospectionEndpoint.validatePermissions(permissions);

        let introspectionResponseObject = {
                ...permissions,
                active: true
        };
        delete introspectionResponseObject.id;
        res.status(200).send(introspectionResponseObject);
    } catch (e) {
      if (e instanceof ValidationError) {
        res.status(400).send(
            new APIError(e.message,
            "MissingParameter",
            400
         ));
      } else if (e instanceof InvalidRPTError || e instanceof ExpiredRPTError) {
        res.status(200).send({active: false});
      } else {
        res.status(500).send(
          new APIError("Internal server error.",
          "internal_error",
          500
        ));
        console.log(e);
      }
    }
  }

  private static validateIntrospectionRequestParams(object: any): void {
    if (!object || !object.token) {
      throw new ValidationError("Bad Request. Expecting a ticket.");
    }
  }

  private static validatePermissions(permissions: TimeStampedPermissions): void {
    if (!permissions) {
      throw new InvalidRPTError();
    } else if (permissions.isExpired()) {
      throw new ExpiredRPTError();
    }
  }

  private init(): void {
    this.router.post("/", this.introspect);
  }
}