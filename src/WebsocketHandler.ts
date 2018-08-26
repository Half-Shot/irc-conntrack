import { Config } from "./Config";
import * as Ws from "ws";
import { Log } from "./Log";
import { EventEmitter } from "events";

const log = new Log("WebsocketHandler");

export class WebsocketHandler extends EventEmitter{
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

        this.on("message", this.onIrcMessage.bind(this));

        // Bind handlers
        connection.onopen = this.onOpen;
        connection.onmessage = this.onMessage;
        connection.onerror = this.onError;
        connection.onclose = this.onClose;
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
    }

    private onError(e: {error: any, message: string, type: string, target: Ws}) {
        log.warn(`onError error=${e.error} type=${e.type} msg=${e.message}`);
    }

    private onClose(e: {wasClean: boolean, code: Number, reason: string, target: Ws}) {
        log.info(`onClose code=${e.code} reason=${e.reason} wasClean=${e.wasClean}`);
    }
}