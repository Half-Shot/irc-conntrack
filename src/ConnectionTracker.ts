import { Config } from "./Config";
import { WebsocketHandler } from "./WebsocketHandler";
import { IConnectionState } from "./Rest/ConnectionsResponse";
import { IrcClient, IrcConnectionOpts } from "./Irc/IrcClient";
import { SocketConstructorOpts, SocketConnectOpts, TcpSocketConnectOpts } from "net";
import * as Uuid from "uuid/v4";
import { IErrorResponse, ERRCODES } from "./Rest/ErrorResponse";
import { Log } from "./Log";

const log = new Log("ConnTrack");

export class ConnectionTracker {
    private ircClients: Map<string,IrcClient>;

    constructor(private config: Config, private wsHandler: WebsocketHandler) {
        this.ircClients = new Map();    
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
        const uuid = Uuid();
        const client = new IrcClient(uuid, opts);
        return client.initiate(serverName, server).then(() => {
            this.ircClients.set(uuid, client);
            return uuid;
        });
    }
}
