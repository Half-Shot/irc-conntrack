import * as express from "express";
import * as expressWs from "express-ws";
import { Application } from "express-ws";
import { Request, Response, NextFunction } from "express";
import { ConnectionTracker } from "./ConnectionTracker";
import { ICConfig } from "./Config";
import { IRoute } from "express-serve-static-core";
import { IErrorResponse, ERRCODES } from "./Rest/ErrorResponse";
import * as Ws from "ws";
import { WebsocketHandler } from "./WebsocketHandler";

export class RestHandler {
    private app?: Application;

    constructor(
        private connTracker: ConnectionTracker,
        private wsHandler: WebsocketHandler,
        private config: ICConfig
    ) {

    }

    public start() {
        let app = express();        
        this.app = expressWs(app).app;        
        this.app.use(this.checkToken.bind(this));
        this.app.get("/_irc/connections/:server", this.getConnections.bind(this));
        this.app.get("/_irc/connections/:server/:id", this.getConnection.bind(this));
        this.app.post("/_irc/connections/:server/open", this.openConnection.bind(this));
        this.app.post("/_irc/connections/:server/disconnect", this.disconnectConnection.bind(this));
        this.app.ws("/_irc/ws", this.openWebsocket.bind(this));
        this.app.get("/_irc/config", this.readConfig.bind(this));
        this.app.post("/_irc/config", this.updateConfig.bind(this));
        this.app.listen(this.config.bindPort, this.config.bindAddress, this.config.backlogLimit);
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

    private openWebsocket(ws: Ws, req: Request) {
        this.wsHandler.addConnection(`${req.hostname}:${req.connection.remotePort}`, ws);
    }
    
    private readConfig(req: Request, res: Response) {
        throw Error("Not implemented yet");
    }
    
    private updateConfig(req: Request, res: Response) {
        throw Error("Not implemented yet");
    }

    private checkToken(req: Request, res: Response, next: NextFunction) {
        let token;
        const authHeader = req.header("Authorization");
        if (authHeader !== undefined) {
            token = authHeader.substr("Beaer ".length);
        } else {
            token = req.query["access_token"];
        }

        if (token === undefined) {
            res.statusCode = 400;
            res.send({
                errcode: ERRCODES.missingToken,
                error: "No token given",
            } as IErrorResponse);
        }

        if (this.config.accessToken === token) {
            next();
        } else {
            res.statusCode = 401;
            res.send({
                errcode: ERRCODES.badToken,
                error: "Token was invalid",
            } as IErrorResponse);        
        }
    }
}
 