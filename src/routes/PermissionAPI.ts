import {Permission} from "../model/Permission";
import {Ticket} from "../model/Ticket";

import {Router, Request, Response, NextFunction} from 'express';

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

  private init():void {
    this.router.get('/', this.getAll);
  }

  public getRouter(): Router {
    return this.router;
  } 

}

// Create the HeroRouter, and export its configured Express.Router
// const permissionAPI = new PermissionAPI();
export default new PermissionAPI();