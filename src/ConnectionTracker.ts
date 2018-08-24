export class ConnectionTracker {
    private ircClients: Map<string,any>;

    constructor() {
        this.ircClients = new Map();    
    }

    public getConnectionsForServer(server: string, detail: string): any[] {
        return 
    }
}
