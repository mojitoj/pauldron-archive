import {TimeStampedPermissions} from "../model/TimeStampedPermissions";
import {APIError} from "../model/APIError";
import {issued_rpts} from "./AuthorizationEndpoint";

import {Router, Request, Response, NextFunction} from "express";
import {request} from "http";
import { InvalidRPTError, ExpiredRPTError, ValidationError, APIAuthorizationError } from "../model/Exceptions";
import { inspect } from "util";
import { User, APIAuthorization } from "../model/APIAuthorization";
import { GenericErrorHandler } from "./GenericErrorHandler";


export class IntrospectionEndpoint {
  router: Router;

  constructor() {
    this.router = Router();
    this.init();
  }

  public introspect(req: Request, res: Response, next: NextFunction): void {
    try {
        const user: User = APIAuthorization.validate(req, ["INTR:R"]);

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
      if (e instanceof InvalidRPTError || e instanceof ExpiredRPTError) {
        res.status(200).send({active: false});
      } else {
        GenericErrorHandler.handle(e, res, req);
      }
    }
  }

  private static validateIntrospectionRequestParams(object: any): void {
    if (!object || !object.token) {
      throw new ValidationError("Bad Request. Expecting a token.");
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