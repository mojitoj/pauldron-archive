import { Permission } from "./Permission";

export class Ticket {
    ticket: string;
    valid_until: number;
    permissions: Permission[];
}