import { Config } from "./Config";
import { WebsocketHandler } from "./WebsocketHandler";
import { IConnectionState } from "./Rest/IConnectionsResponse";
import { IrcClient, IrcConnectionOpts } from "./Irc/IrcClient";
import * as Uuid from "uuid/v4";
import { IErrorResponse, ERRCODES } from "./Rest/IErrorResponse";
import { Log } from "./Log";
import * as Ws from "ws";
import { IMessage } from "./Irc/IMessage";
import {IWsCommand, IWsContentJoinPart, IWsContentSay} from "./WebsocketCommands";
import {Metrics} from "./Metrics";
import { IPoolStream, IPoolStreamConnection } from "./IPoolStream";

const log = new Log("ConnTrack");

export class ConnectionTracker {
    private ircClients: Map<string, IrcClient>;
    private serverClients: Map<string, Set<string>>;

    constructor(private config: Config, private poolStream: IPoolStream) {
        this.ircClients = new Map();
        this.serverClients = new Map();
        poolStream.on("command", this.runCommand.bind(this));
    }

    public getClient(serverName: string, id: string): IrcClient|undefined {
        return this.ircClients.get(id);
    }

    public getConnectionsForServer(serverName: string, detail?: string, id?: string): IConnectionState[] | string[] {
        if (id !== undefined) {
            detail = "state";
        }
        if (detail === undefined || !["ids", "state"].includes(detail)) {
            throw new Error("Unknown value for 'detail' flag");
        }
        log.verbose(`Fetching connections for ${serverName}`);
        if (!this.serverClients.has(serverName)) {
            return [];
        }
        let clients;
        if (!id) {
            clients = [...this.ircClients.values()].filter((client) => {
                return (this.serverClients.get(serverName) as Set<string>).has(client.uuid);
            });
        } else {
            const serverSet = this.serverClients.get(serverName) as Set<string>;
            if (!this.ircClients.has(id) || !serverSet.has(id)) {
                return [];
            }
            clients = [this.ircClients.get(id) as IrcClient];
        }

        if (detail === "ids") {
            return clients.map((client) => client.uuid);
        } // state
        return clients.map((client) => {
            const state = client.ircState as IConnectionState;
            state.id = client.uuid;
            return state;
        }) as IConnectionState[];
    }

    public async openConnection(serverName: string, opts: IrcConnectionOpts): Promise<string> {
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
        log.verbose("Creating new connection with:", JSON.stringify(opts));
        const client = new IrcClient(uuid, opts);
        await client.initiate(server);
        this.ircClients.set(uuid, client);
        let clientServerSet = this.serverClients.get(serverName);
        if (clientServerSet === undefined) {
            clientServerSet = new Set();
            this.serverClients.set(serverName, clientServerSet);
        }
        clientServerSet.add(uuid);
        this.bindListenersForClient(client);
        Metrics.ircConnectionCountGauge.inc({server: serverName});
        return uuid;
    }

    public runCommand(cmd: IWsCommand, ws: IPoolStreamConnection) {
        const UUID_SHORT_LENGTH = 12;
        const ID_SHORT_LENGTH = 12;
        const SHORT_CLI_ID = cmd.client_id.substr(0, UUID_SHORT_LENGTH);
        const SHORT_ID = cmd.id.substr(0, ID_SHORT_LENGTH);
        log.info(`runCommand ${SHORT_CLI_ID} ${SHORT_ID} ${cmd.type}`);
        const client = this.ircClients.get(cmd.client_id);
        if (!client) {
            ws.send(JSON.stringify({id: cmd.id, errcode: ERRCODES.clientNotFound}));
            return;
        }
        if (cmd.type === "raw") {
            client.send(cmd.content as string);
        } else if (cmd.type === "join" || cmd.type === "part") {
            const content = cmd.content as IWsContentJoinPart;
            client[cmd.type](content.channel);
        } else if (cmd.type === "say" || cmd.type === "action" || cmd.type === "notice") {
            const content = cmd.content as IWsContentSay;
            client[cmd.type](content.target, content.text);
        } else {
            ws.send(JSON.stringify({id: cmd.id, errcode: ERRCODES.commandNotRecognised}));
            return;
        }
    }

    private bindListenersForClient(client: IrcClient) {
        client.on("end", () => {
            this.ircClients.delete(client.uuid);
            let serverName: string = "";
            this.serverClients.forEach((set, sName: string) => {set.delete(client.uuid); serverName = sName; });
            Metrics.ircConnectionCountGauge.dec({server: serverName});
            client.msgEmitter.removeAllListeners();
            client.removeAllListeners();
        });
        client.on("raw", (msg: IMessage) => {
            this.poolStream.onIrcMessage("raw", client.uuid, msg);
        });
        client.on("error", (e: string) => {
            log.error("Client emitted an ERROR:", e);
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
                this.poolStream.onIrcMessage(eventName, client.uuid, arg);
            });
        });
    }
}
