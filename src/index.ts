import * as http from "http";
import * as debug from "debug";

import { App } from "./App";

debug("ts-express:server");

export function instantiateServer (port: number, serverConfig: any) {
    const app = new App(serverConfig).express;
    app.set("port", port);
    const server = http.createServer(app);
    server.listen(port);
    server.on("error", onError);
    server.on("listening", () => {
        let addr = server.address();
        let bind = (typeof addr === "string") ? `pipe ${addr}` : `port ${addr.port}`;
        debug(`Listening on ${bind}`);
    });
    return server;
}
const theServerConfig = require("./config.json");
const port = Number(process.env.PORT) || 3000;
export const serverInstance = instantiateServer (port, theServerConfig);

function onError(error: NodeJS.ErrnoException): void {
    if (error.syscall !== "listen") throw error;
    switch (error.code) {
        case "EACCES":
            console.error(`Cannot start the server: The port requires elevated privileges`);
            process.exit(1);
            break;
        case "EADDRINUSE":
            console.error(`Cannot start the server: The port is already in use`);
            process.exit(1);
            break;
        default:
            throw error;
    }
}