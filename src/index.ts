import * as http from "http";
import * as debug from "debug";

import { App } from "./App";

debug("ts-express:server");

export function instantiateServer (port: number) {
    const app = new App().express;
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

export const serverInstance = instantiateServer (3000);

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