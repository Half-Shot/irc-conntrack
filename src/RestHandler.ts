import * as express from "express";
import { Express, Request, Response } from "express";
import { ConnectionTracker } from "./ConnectionTracker";
import { IRoute } from "express-serve-static-core";
import { IErrorResponse, ERRCODES } from "./Rest/ErrorResponse";

export class RestHandler {
    private connTracker: ConnectionTracker;
    private app?: Express;
    private port: Number;

    constructor(connTracker: ConnectionTracker, port: Number) {
        this.connTracker = connTracker;
        this.port = port;
    }

    public start() {
        this.app = express();
        this.app.get("/_irc/connections/:server", this.getConnections.bind(this));
        this.app.get("/_irc/connections/:server/:id", this.getConnection.bind(this));
        this.app.post("/_irc/connections/:server/open", this.openConnection.bind(this));
        this.app.post("/_irc/connections/:server/disconnect", this.disconnectConnection.bind(this));
        this.app.get("/_irc/ws", this.openWebsocket.bind(this));
        this.app.get("/_irc/config", this.readConfig.bind(this));
        this.app.post("/_irc/config", this.updateConfig.bind(this));
        this.app.listen(this.port);
    }

    private getConnections(req: Request, res: Response) {
        const detail = req.query["detail"] || "simple";
        this.connTracker.getConnectionsForServer(req.query["server"], detail);
        throw Error("Not implemented yet");
    }

    private getConnection(req: Request, res: Response) {
        throw Error("Not implemented yet");
    }

    private openConnection(req: Request, res: Response) {
        throw Error("Not implemented yet");
    }

    private disconnectConnection(req: Request, res: Response) {
        throw Error("Not implemented yet");
    }

    private openWebsocket(req: Request, res: Response) {
        throw Error("Not implemented yet");
    }
    
    private readConfig(req: Request, res: Response) {
        throw Error("Not implemented yet");
    }
    
    private updateConfig(req: Request, res: Response) {
        throw Error("Not implemented yet");
    }
}
 