import * as jwt from "jsonwebtoken";
import { APIAuthorizationError } from "./Exceptions";
import { Request} from "express";
import { read } from "fs";

class APIKey {
    uid: string;
    nbf: number;
    exp: number;
    scopes: string[];
}

export class User {
    id: string;
}

export class APIAuthorization {
    private static getAPIKeyFromHeader (request: Request): string {
        if (!request.get("authorization")
        || ! request.get("authorization").includes("Bearer ")
        || request.get("authorization").split(" ").length < 2) {
        throw new APIAuthorizationError ("Expecting Authorization header to be set as 'Bearer {API Key}'.");
      }
      const apiKey = request.get("authorization").split(" ")[1];
      return apiKey;
    }
    public static validate (request: Request, requiredScopes: string[], serverConfig: any): User {
        const apiKey = APIAuthorization.getAPIKeyFromHeader(request);
        let payload: APIKey = null;
        try {
            payload = jwt.verify(apiKey, serverConfig.uma.apiKeys.secretKey) as APIKey;
        } catch (e) {
            throw new APIAuthorizationError(`Malformed API key.`);
        }
        if (!payload.uid) {
            throw new APIAuthorizationError(`Malformed API key. Missing 'uid'`);
        }
        const hasSufficientScopes = requiredScopes.map((requiredScope) => (payload.scopes.includes(requiredScope)))
                        .reduce((sofar, thisOne) => (
                            sofar && thisOne
                        ), true);
        if (!hasSufficientScopes) {
            throw new APIAuthorizationError(`Insufficient scopes on the API key.`);
        }
        return {
            id: payload.uid
        };
        // todo: check validy period.
    }
}