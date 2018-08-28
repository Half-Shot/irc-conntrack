import { Config } from "./Config";
import { WebsocketHandler, IWsCommand } from "./WebsocketHandler";
import { IConnectionState } from "./Rest/ConnectionsResponse";
import { IrcClient, IrcConnectionOpts } from "./Irc/IrcClient";
import { SocketConstructorOpts, SocketConnectOpts, TcpSocketConnectOpts } from "net";
import * as Uuid from "uuid/v4";
import { IErrorResponse, ERRCODES } from "./Rest/ErrorResponse";
import { Log } from "./Log";
import * as Ws from "ws";

const log = new Log("ConnTrack");

export class ConnectionTracker {
    private ircClients: Map<string,IrcClient>;

    constructor(private config: Config, private wsHandler: WebsocketHandler) {
        this.ircClients = new Map();
        wsHandler.on("command", this.runCommand.bind(this));
    }

    public getConnectionsForServer(server: string, detail: string): IConnectionState[] | String[] {
        log.verbose(`Fetching connections for ${server}`);
        if (detail === "ids") {
            return [...this.ircClients.keys()];
        }
        return [] as IConnectionState[];
    }

    public openConnection(serverName: string, opts: IrcConnectionOpts): Promise<string> {
        const server = this.config.serverConfig(serverName);
        if (server === undefined) {
            log.warn(`Connection was requested for unknown server ${serverName}`);
            return Promise.reject(
                {error: "Server is not in config", errcode: ERRCODES.notInConfig} as IErrorResponse
            );
        }
        if (server.maxConnections === this.ircClients.size) {
            log.warn(`At connection limit (${server.maxConnections}) for ${serverName}`);
            return Promise.reject(
                {error: "No more slots on this node", errcode: ERRCODES.connectionLimit} as IErrorResponse
            );
        }
        const uuid = Uuid();
        const client = new IrcClient(uuid, opts);
        return client.initiate(serverName, server).then(() => {
            this.ircClients.set(uuid, client);
            client.on("raw", (msg) => {
                this.wsHandler.onIrcMessage("raw", uuid, msg);
            });
            return uuid;
        });
    }

    public runCommand(cmd : IWsCommand, ws: Ws) {
        log.info(`runCommand - ${cmd.client_id.substr(0,12)} - ${cmd.id.substr(0,12)}`);
        const client = this.ircClients.get(cmd.client_id);
        if (!client) {
            ws.send(JSON.stringify({id: cmd.id, errcode: ERRCODES.clientNotFound})); 
            return;
        }
        if (cmd.type === "raw") {
            client.write(cmd.content as string);
        }
    }
}
