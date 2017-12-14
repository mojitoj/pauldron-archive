import {Permission} from "../model/Permission";
import {TimeStampedPermissions} from "../model/TimeStampedPermissions";
import {APIError} from "../model/APIError";
import {Router, Request, Response, NextFunction} from "express";
import { request } from "http";
import { ValidationError, APIAuthorizationError } from "../model/Exceptions";
import {serverConfig} from "../model/ServerConfig";
import { APIAuthorization, User } from "../model/APIAuthorization";

export let registered_permissions: { [ticketId: string]: TimeStampedPermissions } = {};


export class PermissionEndpoint {
  router: Router;

  constructor() {
    this.router = Router();
    this.init();
  }

  public getAll(req: Request, res: Response, next: NextFunction): void {
    try {
      const user: User = APIAuthorization.validate(req, ["PERMS:L"]);

      res.send(registered_permissions);
    } catch (e) {
      if (e instanceof APIAuthorizationError) {
        res.status(403).send(
            new APIError(`API authorization error: ${e.message}.`,
            "api_auth_error",
            403
        ));
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

  public createANewOne(req: Request, res: Response, next: NextFunction): void {
    try {
      const user: User = APIAuthorization.validate(req, ["PERMS:C"]);

      PermissionEndpoint.validatePermissionCreationParams(req.body);
      const ticket: TimeStampedPermissions = TimeStampedPermissions.issue(serverConfig.uma.permission.ticket.ttl, req.body);
      registered_permissions[ticket.id] = ticket;
      res.status(201).send({ticket: ticket.id});
    } catch (e) {
      if (e instanceof ValidationError) {
        res.status(400).send(
            new APIError(e.message,
            "MissingParameter",
            400
         ));
      } else if (e instanceof APIAuthorizationError) {
        res.status(403).send(
            new APIError(`API authorization error: ${e.message}.`,
            "api_auth_error",
            403
        ));
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

  private static validatePermissionCreationParams(object: any): void {
    if (object instanceof Array && Permission.validateArray(object)) {
      return;
    } else if (Permission.validate(object)) {
      return;
    }
    throw new ValidationError ("Bad Request. Expecting a Permissin or Permission array.");
  }

  private init(): void {
    this.router.get("/", this.getAll);
    this.router.post("/", this.createANewOne);
  }
}