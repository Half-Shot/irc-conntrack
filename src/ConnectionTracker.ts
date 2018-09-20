import { Config } from "./Config";
import { WebsocketHandler, IWsCommand } from "./WebsocketHandler";
import { IConnectionState } from "./Rest/IConnectionsResponse";
import { IrcClient, IrcConnectionOpts } from "./Irc/IrcClient";
import * as Uuid from "uuid/v4";
import { IErrorResponse, ERRCODES } from "./Rest/IErrorResponse";
import { Log } from "./Log";
import * as Ws from "ws";
import { IMessage } from "./Irc/IMessage";

const log = new Log("ConnTrack");

export class ConnectionTracker {
    private ircClients: Map<string, IrcClient>;
    private serverClients: Map<string, Set<string>>;

    constructor(private config: Config, private wsHandler: WebsocketHandler) {
        this.ircClients = new Map();
        this.serverClients = new Map();
        wsHandler.on("command", this.runCommand.bind(this));
    }

    public getConnectionsForServer(serverName: string, detail: string): IConnectionState[] | string[] {
        if (!["ids", "state"].includes(detail)) {
    public getClient(serverName: string, id: string): IrcClient|undefined {
        return this.ircClients.get(id);
    }
            throw new Error("Unknown value for 'detail' flag");
        }
        log.verbose(`Fetching connections for ${serverName}`);
        if (!this.serverClients.has(serverName)) {
            return [];
        }
        const clients = [...this.ircClients.values()].filter((client) => {
            return (this.serverClients.get(serverName) as Set<string>).has(client.uuid);
        });
        if (detail === "ids") {
            return clients.map((client) => client.uuid);
        } // state
        return clients.map((client) => {
            const state = client.ircState as IConnectionState;
            state.id = client.uuid;
            return state;
        }) as IConnectionState[];
    }

    public openConnection(serverName: string, opts: IrcConnectionOpts): Promise<string> {
        const server = this.config.serverConfig(serverName);
        if (server === undefined) {
            log.warn(`Connection was requested for unknown server ${serverName}`);
            return Promise.reject(
                {error: "Server is not in config", errcode: ERRCODES.notInConfig} as IErrorResponse,
            );
        }
        if (server.maxConnections === this.ircClients.size) {
            log.warn(`At connection limit (${server.maxConnections}) for ${serverName}`);
            return Promise.reject(
                {error: "No more slots on this node", errcode: ERRCODES.connectionLimit} as IErrorResponse,
            );
        }
        const uuid = Uuid();
        const client = new IrcClient(uuid, opts);
        return client.initiate(server).then(() => {
            this.ircClients.set(uuid, client);
            let clientServerSet = this.serverClients.get(serverName);
            if (clientServerSet === undefined) {
                clientServerSet = new Set();
                this.serverClients.set(serverName, clientServerSet);
            }
            clientServerSet.add(uuid);
            this.bindListenersForClient(client);
            return uuid;
        });
    }

    public runCommand(cmd: IWsCommand, ws: Ws) {
        const UUID_SHORT_LENGTH = 12;
        const ID_SHORT_LENGTH = 12;
        log.info(`runCommand ${cmd.client_id.substr(0, UUID_SHORT_LENGTH)} ${cmd.id.substr(0, ID_SHORT_LENGTH)}`);
        if (!["raw"].includes(cmd.type)) {
            ws.send(JSON.stringify({id: cmd.id, errcode: ERRCODES.commandNotRecognised}));
            return;
        }
        const client = this.ircClients.get(cmd.client_id);
        if (!client) {
            ws.send(JSON.stringify({id: cmd.id, errcode: ERRCODES.clientNotFound}));
            return;
        }
        if (cmd.type === "raw") {
            client.send(cmd.content as string);
        }
    }

    private bindListenersForClient(client: IrcClient) {
        client.on("end", () => {
            this.ircClients.delete(client.uuid);
            this.serverClients.forEach((set) => set.delete(client.uuid));
            client.msgEmitter.removeAllListeners();
            client.removeAllListeners();
        });
        client.on("raw", (msg: IMessage) => {
            this.wsHandler.onIrcMessage("raw", client.uuid, msg);
        });
        const emitter = client.msgEmitter;
        const LISTEN_FOR = [
            "registered",
            "channellist",
            "privmsg",
            "mode",
            "whois",
            "nick",
            "names",
            "topic",
            "mode_is",
            "join",
            "part",
            "kick",
            "notice",
            "kill",
            "quit",
            "invite",
            "supports",
        ];
        LISTEN_FOR.forEach((eventName) => {
            emitter.on(eventName, (arg) => {
                this.wsHandler.onIrcMessage(eventName, client.uuid, arg);
            });
        });
    }
}
