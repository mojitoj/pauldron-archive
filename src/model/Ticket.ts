import { Permission } from "./Permission";
import {v4 as uuid} from "uuid";


export class Ticket {
    ticket: string;
    valid_until: number;
    permissions: Permission[];

    public static issue (validityInSeconds: number, permissions: Permission[] | Permission): Ticket {
        let theTicket = new Ticket();
        theTicket.ticket = uuid();
        theTicket.valid_until = new Date().valueOf() + validityInSeconds;
        if (permissions instanceof Array) {
            theTicket.permissions = permissions;
        } else {
            let permissionsWrapper : Permission[] = [];
            permissionsWrapper.push(permissions);
            theTicket.permissions = permissionsWrapper;
        }
        return theTicket;
    }

}