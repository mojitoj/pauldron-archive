import {Permission} from "../model/Permission";
import {Ticket} from "../model/Ticket";
import {APIError} from "../model/APIError";


import {Router, Request, Response, NextFunction} from 'express';
import { request } from "http";

let registered_permissions: Ticket[]=[];

export class PermissionAPI {
  router: Router

  constructor() {
    this.router = Router();
    this.init();
  }

  public getAll(req: Request, res: Response, next: NextFunction): void {
    res.send(registered_permissions);
  }

  public createANewOne(req: Request, res: Response, next: NextFunction): void {
    try {
      PermissionAPI.validatePermissionCreationParams(req.body);
      const ticket:Ticket = Ticket.issue(2000, req.body);
      registered_permissions.push(ticket);
      res.status(201)
        .send(ticket);
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
    } else if (Permission.validate(object)){
      return;
    }
    throw new Error ("Bad Request. Expecting a Permissin or Permission array.");
  }

  private init():void {
    this.router.get("/", this.getAll);
    this.router.post("/", this.createANewOne);
  }
}

// Create the HeroRouter, and export its configured Express.Router
// const permissionAPI = new PermissionAPI();
export default new PermissionAPI();