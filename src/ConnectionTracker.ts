import { ICConfig } from "./Config";
import { WebsocketHandler } from "./WebsocketHandler";

export class ConnectionTracker {
    private ircClients: Map<string,any>;

    constructor(private config: ICConfig, private wsHandler: WebsocketHandler) {
        this.ircClients = new Map();    
    }

    public getConnectionsForServer(server: string, detail: string): any[] {
        return [];
    }
}
