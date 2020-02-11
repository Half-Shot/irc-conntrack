import { IClientPool } from "./IClientPool";
import { Config } from "./Config";
import { ConnectionTracker } from "./ConnectionTracker";
import { IPoolStream, IPoolStreamConnection } from "./IPoolStream";
import { IWsCommand } from "./WebsocketCommands";
import { IrcClient } from "./Irc/IrcClient";
import { IMessage } from "./Irc/IMessage";

/**
 * Implements a in-process connection pool.
 */
export class MonolithPool implements IClientPool, IPoolStream {
    private tracker: ConnectionTracker;
    constructor(private config: Config) {
        this.tracker = new ConnectionTracker(config, this);
    }

    public onIrcMessage(event: string, id: string, msg: IMessage) {
        throw new Error("Method not implemented.");
    }

    public on(eventName: "command", func: (cmd: IWsCommand, ws: IPoolStreamConnection) => void) {
        // This would be used to emit commands to be run on clients, however a monolith pool provides
        // the IrcClient directly to the application which makes this unused.
    }

    public getClientById(servername: string, id: string) {
        return this.tracker.getClient(servername, id);
    }

    public getConnections(servername: string, detail: "state"|"ids" = "state") {
        return this.tracker.getConnectionsForServer(servername, detail);
    }
}
