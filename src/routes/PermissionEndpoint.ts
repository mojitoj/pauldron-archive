import {Permission} from "../model/Permission";
import {TimeStampedPermissions} from "../model/TimeStampedPermissions";
import {APIError} from "../model/APIError";
import {config} from "../config";
import {Router, Request, Response, NextFunction} from "express";
import { request } from "http";

export let registered_permissions: { [ticketId: string]: TimeStampedPermissions } = {};


export class PermissionEndpoint {
  router: Router;

  constructor() {
    this.router = Router();
    this.init();
  }

  public getAll(req: Request, res: Response, next: NextFunction): void {
    res.send(registered_permissions);
  }

  public createANewOne(req: Request, res: Response, next: NextFunction): void {
    try {
      PermissionEndpoint.validatePermissionCreationParams(req.body);
      const ticket: TimeStampedPermissions = TimeStampedPermissions.issue(config.permission.ticket.ttl, req.body);
      registered_permissions[ticket.id] = ticket;
      res.status(201)
        .send({ticket: ticket.id});
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

  private static validatePermissionCreationParams(object: any): void {
    if (object instanceof Array && Permission.validateArray(object)) {
      return;
    } else if (Permission.validate(object)) {
      return;
    }
    throw new Error ("Bad Request. Expecting a Permissin or Permission array.");
  }

  private init(): void {
    this.router.get("/", this.getAll);
    this.router.post("/", this.createANewOne);
  }
}

export default new PermissionEndpoint();