import { ICConfig } from "./Config";
import * as Ws from "ws";

export class WebsocketHandler {
    private connections: Map<string,Ws>;

    constructor (private config : ICConfig) {
        this.connections = new Map();
    }

    public addConnection(host: string, connection: Ws) {
        if (this.connections.has(host)) {
            this.dropConnection(host);
        }
        this.connections.set(host, connection);
        if (this.connections.size === this.config.maximumWebsocketConnections) {
            this.dropConnection(this.connections.keys().next().value);
        }

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

    private onOpen(event: {target: Ws}) {
        console.log(`[WsHandler] onOpen ${JSON.stringify(event)}`);
    }

    private onMessage(event: {data: Ws.Data, type: string, target: Ws}) {
        console.log(`[WsHandler] onMessage ${JSON.stringify(event)}`);
    }

    private onError(event: {error: any, message: string, type: string, target: Ws}) {
        console.log(`[WsHandler] onError ${JSON.stringify(event)}`);
    }

    private onClose(event: {wasClean: boolean, code: Number, reason: string, target: Ws}) {
        console.log(`[WsHandler] onClose ${JSON.stringify(event)}`);
    }
}