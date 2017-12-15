import {Request, Response} from "express";
import { ValidationError, APIAuthorizationError, ObjectNotFoundError } from "../model/Exceptions";

export class GenericErrorHandler {
    public static handle(e: Error, response: Response, request: Request) {
        if (e instanceof ValidationError) {
            response.status(400).send(
              {
                  message: e.message,
                  error: "missing_parameter",
                  status: 400
              }
            );
        } else if (e instanceof APIAuthorizationError) {
            response.status(403).send(
                {
                    message: `API authorization error: ${e.message}.`,
                    error: "api_auth_error",
                    status: 403
                }
            );
        } else if (e instanceof ObjectNotFoundError) {
            response.status(404).send(
                {
                    message: `Object not found: ${e.message}.`,
                    error: "object_not_found",
                    status: 404
                }
            );
        } else {
            response.status(500).send(
                {
                    message: "Internal server error.",
                    error: "internal_error",
                    status: 500
                }
            );
            console.log(e);
        }
    }
}