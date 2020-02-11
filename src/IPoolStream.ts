import { IMessage } from "./Irc/IMessage";
import { IWsCommand } from "./WebsocketCommands";

/**
 * This is an interface that handles communication between a pool, and the connection tracker.
 * Typically this is a websocket but may take the form of a more traditional TCP socket, IPC
 * or simply a monolith communication method.
 */

export interface IPoolStreamConnection {
    send(data: string): void;
}

export interface IPoolStream {
    onIrcMessage(event: string, id: string, msg: IMessage): void;
    on(eventName: "command", func: (cmd: IWsCommand, ws: IPoolStreamConnection) => void ): void;
}
