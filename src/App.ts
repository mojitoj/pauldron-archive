import * as express from "express";
import * as logger from "morgan";
import * as bodyParser from "body-parser";
import permissionAPI from "./routes/PermissionAPI";

// Creates and configures an ExpressJS web server.
class App {

    // ref to Express instance
    public express: express.Application;

    // Run configuration methods on the Express instance.
    constructor() {
        this.express = express();
        this.routes();
        this.middleware();
    }

    // Configure Express middleware.
    private middleware(): void {
        this.express.use(logger("dev"));
        this.express.use(bodyParser.json());
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
        this.express.use("/permissions", permissionAPI.getRouter());        
    }

}

export default new App().express;
