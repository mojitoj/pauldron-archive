import * as express from "express";
import * as logger from "morgan";
import * as bodyParser from "body-parser";
import permissionEndpoint from "./routes/PermissionEndpoint";
import authorizationEndpoint from "./routes/AuthorizationEndpoint";
import introspectionEndpoint from "./routes/IntrospectionEndpoint";

export const permissionEndpointURI: string = "/protection/permissions";
export const introspectionEndpointURI: string = "/protection/introspection";
export const authorizationEndpointURI: string = "/authorization";

// Creates and configures an ExpressJS web server.
class App {

    // ref to Express instance
    public express: express.Application;

    // Run configuration methods on the Express instance.
    constructor() {
        this.express = express();
        this.middleware();
        this.routes();
    }

    // Configure Express middleware.
    private middleware(): void {
        this.express.use(logger("dev"));
        this.express.use(bodyParser.json({type: "application/json"}));
        this.express.use(bodyParser.urlencoded({ extended: false }));
    }

    // Configure API endpoints.
    private routes(): void {
        const router = express.Router();
        router.get("/", (req, res) => {
          res.json({
            path: "root"
          });
        });
        this.express.use("/", router);
        this.express.use(permissionEndpointURI, permissionEndpoint.router);
        this.express.use(introspectionEndpointURI, introspectionEndpoint.router);
        this.express.use(authorizationEndpointURI, authorizationEndpoint.router);
    }
}

export default new App().express;
