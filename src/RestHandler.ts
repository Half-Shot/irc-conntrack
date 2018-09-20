import * as express from "express";
import * as expressWs from "express-ws";
import { Application } from "express-ws";
import * as Ws from "ws";
import { Request, Response, NextFunction } from "express";
import { ConnectionTracker } from "./ConnectionTracker";
import { Config } from "./Config";
import { IErrorResponse, ERRCODES } from "./Rest/IErrorResponse";
import { WebsocketHandler } from "./WebsocketHandler";
import { Log } from "./Log";
import {IConnectionsResponse, IConnectionState} from "./Rest/IConnectionsResponse";
import { IOpenResponse } from "./Rest/IOpenResponse";
import { IrcConnectionOpts } from "./Irc/IrcClient";
import * as HttpStatus from "http-status-codes";

const log = new Log("RestHandler");
const logHttp = new Log("http");

export class RestHandler {
    private app?: Application;

    constructor(
        private connTracker: ConnectionTracker,
        private wsHandler: WebsocketHandler,
        private config: Config,
    ) {

    }

    public configure() {
        const app = express();
        this.app = expressWs(app).app;
        this.app.use(express.json());
        this.app.use(this.logRequest.bind(this));
        this.app.use(this.checkToken.bind(this));
        this.app.get("/_irc/connections/:server", this.getConnections.bind(this));
        this.app.get("/_irc/connections/:server/:id", this.getConnection.bind(this));
        this.app.post("/_irc/connections/:server/open", this.openConnection.bind(this));
        this.app.post("/_irc/connections/:server/disconnect", this.disconnectConnection.bind(this));
        this.app.ws("/_irc/ws", this.openWebsocket.bind(this));
        this.app.get("/_irc/config", this.readConfig.bind(this));
        this.app.post("/_irc/config", this.updateConfig.bind(this));
    }

    public listen() {
        if (this.app === undefined) {
            throw Error("configure() should be called first");
        }
        log.info(`Listening on ${this.config.bindAddress}:${this.config.bindPort}`);
        this.app.listen(this.config.bindPort, this.config.bindAddress, this.config.backlogLimit);
    }

    private getConnections(req: Request, res: Response) {
        const detail = req.query.detail || "ids";
        const conns = this.connTracker.getConnectionsForServer(req.params.server, detail);
        res.send({connections: conns} as IConnectionsResponse);
    }

    private getConnection(req: Request, res: Response) {
        // NOTE: This always returns "state" for detail.
        const conn = this.connTracker.getConnectionsForServer(
            req.params.server,
            undefined,
            req.params.id,
        );
        res.send(conn[0] as IConnectionState);
    }

    private openConnection(req: Request, res: Response) {
        this.connTracker.openConnection(req.params.server,
            req.body as IrcConnectionOpts,
        ).then((id: string) => {
            res.statusCode = HttpStatus.OK;
            res.send({
                id,
            } as IOpenResponse);
        }).catch((err: Error) => {
            res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            res.send(err);
        });
    }

    private disconnectConnection(req: Request, res: Response) {
        const msg = req.query.reason || "remotely disconnected client";
        const client = this.connTracker.getClient(req.params.server, req.params.id);
        if (!client) {
            res.send({errcode: ERRCODES.clientNotFound, error: "Could not find client"} as IErrorResponse);
            return;
        }
        client.disconnect(msg).then(() => {
            res.send({});
        }).catch((err: Error) => {
            res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            res.send(err);
        });
    }

    private openWebsocket(ws: Ws, req: Request) {
        this.wsHandler.addConnection(`${req.hostname}:${req.connection.remotePort}`, ws);
    }

    private readConfig(req: Request, res: Response) {
        res.send(this.config.rawDocument);
    }

    private updateConfig(req: Request, res: Response) {
        if (this.config.filename === undefined) {
            res.statusCode = HttpStatus.LOCKED;
            res.send({
                errcode: ERRCODES.genericFail,
                error: "Service was not started with a config file, so cannot load.",
            } as IErrorResponse);
            return;
        }
        let newConfig: Config;
        try {
            newConfig = Config.parseFile(this.config.filename);
        } catch (e) {
            log.error("Config file failed to parse", e);
            res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            res.send({
                errcode: ERRCODES.genericFail,
                error: "Config failed to parse:" + e.message ,
            } as IErrorResponse);
            return;
        }
        try {
            this.config.applyConfig(newConfig);
            this.readConfig(req, res);
        } catch (e) {
            log.error("Config file could not be applied", e);
            res.statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
            res.send({
                errcode: ERRCODES.genericFail,
                error: "Config file could not be applied:" + e.message ,
            } as IErrorResponse);
            return;
        }
    }

    private checkToken(req: Request, res: Response, next: NextFunction) {
        let token;
        const authHeader = req.header("Authorization");
        if (authHeader !== undefined) {
            token = authHeader.substr("Bearer ".length);
        } else {
            token = req.query.access_token;
        }

        if (token === undefined) {
            logHttp.warn("rejecting because token was not given");
            res.statusCode = HttpStatus.BAD_REQUEST;
            res.send({
                errcode: ERRCODES.missingToken,
                error: "No token given",
            } as IErrorResponse);
            return;
        }

        if (this.config.accessToken === token) {
            next();
        } else {
            logHttp.warn("rejecting because token was invalid");
            res.statusCode = HttpStatus.UNAUTHORIZED;
            res.send({
                errcode: ERRCODES.badToken,
                error: "Token was invalid",
            } as IErrorResponse);
        }
    }

    private logRequest(req: Request, res: Response, next: NextFunction) {
        const body = req.body === undefined ? "" : req.body;
        logHttp.verbose(`${req.hostname}:${req.connection.remotePort} ${req.method} ` +
                        `${req.path} ${JSON.stringify(req.query)} ${req.method === "GET" ? body : ""}`);
        next();
    }
}
