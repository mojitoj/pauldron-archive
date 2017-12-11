import {Router, Request, Response, NextFunction} from "express";
import { ValidationError } from "../model/Exceptions";
import { Policy, SimplePolicyEngine } from "pauldron-policy";
import * as hash from "object-hash";
import { APIError } from "../model/APIError";

export const policyTypeToEnginesMap = {
    "pauldron:simple-policy": new SimplePolicyEngine()
};

// export let policies: { [id: string]: Policy } = {};

export class PolicyEndpoint {
    router: Router;

    constructor() {
      this.router = Router();
      this.init();
    }

    public createANewOne(req: Request, res: Response, next: NextFunction): void {
        try {
            let policies = req.app.locals.policies;
            PolicyEndpoint.validateNewPolicyRequestParams(req.body);
            const policy = req.body as Policy;
            const id = hash(policy);
            if (! policies[id]) {
                policies[id] = policy;
                res.status(201).send(
                    {
                        "id": id,
                        ... policies[id]
                    }
                );

            } else {
                res.status(200).send(
                    {
                        "id": id,
                        ... policies[id]
                    }
                );
            }
        } catch (e) {
            if (e instanceof ValidationError) {
              res.status(400).send(
                  new APIError(e.message,
                  "MissingParameter",
                  400
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

    public getAll(req: Request, res: Response, next: NextFunction): void {
        const policies = req.app.locals.policies;
        res.status(200).send(Object.keys(policies)
            .map((id) => (
                {
                    "id": id,
                    ... policies[id]
                }
            ))
        );
    }

    public getOne(req: Request, res: Response, next: NextFunction): void {
        const policies = req.app.locals.policies;
        const id = req.params.id;
        const policy = policies [id];
        if (policy) {
            res.status(200).send({
                "id": id,
                ... policy
            });
        } else {
            res.status(404).send(
                new APIError(`No policy exists by the id '${id}'.`,
                "ObjectNotFound",
                404
            ));
        }
    }
    private static validateNewPolicyRequestParams(object: any): void {
        if (!object) {
            throw new ValidationError ("Bad Request.");
        } else if (! object.type || ! ((object.type as string).length > 0 )) {
            throw new ValidationError ("Bad Request. Expecting a valid 'type'.");
        } else if (! Object.keys(policyTypeToEnginesMap).includes(object.type)) {
            throw new ValidationError
            (`Bad Request. The server does not support policy type ${object.type}. Current supported formats: ${Object.keys(policyTypeToEnginesMap).join(",")}`);
        } else if (! object.content) {
            throw new ValidationError ("Bad Request. Expecting a valid 'content'.");
        }
        // todo more validation based on the type. Each type must have its own validator to be called.
    }
    private init(): void {
        this.router.post("/", this.createANewOne);
        this.router.get("/", this.getAll);
        this.router.get("/:id", this.getOne);
    }
}