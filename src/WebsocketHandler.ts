import { Config } from "./Config";
import * as Ws from "ws";
import { Log } from "./Log";
import { EventEmitter } from "events";
import { IMessage } from "./Irc/IMessage";
import {IWsCommand} from "./WebsocketCommands";
import {Metrics} from "./Metrics";

const log = new Log("WebsocketHandler");

export interface IWsIrcMessage {
    client_id: string;
    event: string;
    msg: IMessage;
}

interface ICloseArgs {
    wasClean: boolean;
    code: number;
    reason: string;
    target: Ws;
}

export class WebsocketHandler extends EventEmitter {
    private connections: Map<string, Ws>;

    constructor(private config: Config) {
        super();
        this.connections = new Map();
    }

    public addConnection(host: string, connection: Ws) {
        log.info(`New connection from ${host}`);
        if (this.connections.has(host)) {
            log.warn("Dropping previous connection");
            this.dropConnection(host);
        }
        this.connections.set(host, connection);
        if (this.connections.size > this.config.maximumWebsocketConnections) {
            log.warn("At connection limit, dropping a connection");
            this.dropConnection(this.connections.keys().next().value);
        }

        // Bind handlers
        Metrics.openWebsocketConnections.inc({host});
        connection.onmessage = this.onMessage.bind(this);
        connection.onerror = this.onError.bind(this);
        connection.onclose = (e: ICloseArgs) => {
            this.onClose(e, host);
        };
        this.emit("connected", host, connection);
    }

    public dropConnection(host: string) {
        if (!this.connections.has(host)) {
            throw new Error(`${host} is not connected`);
        }
        const conn = this.connections.get(host) as Ws;
        this.emit("dropping", host, conn);
        conn.terminate();
        this.emit("dropped", host);
    }

    public onIrcMessage(event: string, id: string, msg: IMessage) {
        this.connections.forEach((cn) => {
            Metrics.websocketMessagesSent.inc();
            cn.send(JSON.stringify({event, client_id: id, msg} as IWsIrcMessage));
        });
    }

    private onMessage(e: {data: Ws.Data, type: string, target: Ws}) {
        log.verbose(`onMessage type=${e.type} data=${e.data}`);
        try {
             const cmd = JSON.parse(e.data as string) as any;
             const missingKeys = ["client_id", "id", "type"].filter((key) => typeof(cmd[key]) !== "string");
             if (missingKeys.length > 0) {
                throw new Error(`Missing "${missingKeys.join("\",\"")}" from command`);
             }
             const wsCmd = cmd as IWsCommand;
             log.info(
                 `Got command type=${wsCmd.type} id=${wsCmd.id}` +
                      `client=${wsCmd.client_id} content=${JSON.stringify(wsCmd.content)}`,
             );
             Metrics.websocketMessagesReceived.inc();
             this.emit("command", wsCmd, e.target);
        } catch (e) {
            // Command not understood. Not saying anything.
            log.warn("Failed to execute command:", e);
        }
    }

    private onError(e: {error: object|string, message: string, type: string, target: Ws}) {
        log.warn(`onError error=${e.error} type=${e.type} msg=${e.message}`);
    }

    private onClose(e: ICloseArgs, host: string) {
        log.info(`onClose code=${e.code} reason=${e.reason} wasClean=${e.wasClean}`);
        Metrics.openWebsocketConnections.dec({host});
        this.connections.delete(host);
    }
}
