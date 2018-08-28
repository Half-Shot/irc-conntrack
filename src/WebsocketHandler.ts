import { Config } from "./Config";
import * as Ws from "ws";
import { Log } from "./Log";
import { EventEmitter } from "events";
import { ConnectionTracker } from "./ConnectionTracker";
import { IMessage } from "./Irc/IMessage";

const log = new Log("WebsocketHandler");

export interface IWsCommand {
    client_id: string,
    id: string,
    type: string, // ["raw","join"]
    content: any,
}

export class WebsocketHandler extends EventEmitter {
    private connections: Map<string,Ws>;

    constructor (private config : Config) {
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
        if (this.connections.size === this.config.maximumWebsocketConnections) {
            log.warn("At connection limit, dropping a connection");
            this.dropConnection(this.connections.keys().next().value);
        }


        // Bind handlers
        connection.onopen = this.onOpen;
        connection.onerror = this.onError;
        connection.onclose = this.onClose;
        connection.onmessage = this.onMessage.bind(this);
    }

    public dropConnection(host: string) {
        if (!this.connections.has(host)) {
            throw new Error(`${host} is not connected`);
        }
        const conn = this.connections.get(host) as Ws;
        conn.terminate();
    }

    private onIrcMessage(event: string, ...args: any[]) {
        this.connections.forEach((cn) => {
            cn.send({event, args});
        })
    }

    private onOpen(e: {target: Ws}) {
        log.info(`onOpen url=${e.target.url} state=${e.target.readyState}`);
    }

    private onMessage(e: {data: Ws.Data, type: string, target: Ws}) {
        log.verbose(`onMessage type=${e.type} data=${e.data}`);
        try {
             let cmd = JSON.parse(e.data as string) as IWsCommand;
             log.info(`Got command type=${cmd.type} id=${cmd.id} client=${cmd.client_id} content=${cmd.content}`);
             this.emit("command", cmd, e.target);
        } catch (e) {
            // Command not understood. Not saying anything.
            log.warn("Failed to execute command:",e);
        }
    }

    private onError(e: {error: any, message: string, type: string, target: Ws}) {
        log.warn(`onError error=${e.error} type=${e.type} msg=${e.message}`);
    }

    private onClose(e: {wasClean: boolean, code: Number, reason: string, target: Ws}) {
        log.info(`onClose code=${e.code} reason=${e.reason} wasClean=${e.wasClean}`);
    }
}