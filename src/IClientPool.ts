import { IrcClient } from "./Irc/IrcClient";
import { IConnectionState } from "./Rest/IConnectionsResponse";

/**
 * The IClientPool interface is for implementing a common interface
 * to talk to both monolith connection pools and remote connection pools.
 */
export interface IClientPool {
    getClientById(servername: string, id: string): IrcClient|undefined;
    getConnections(servername: string, detail: "state"|"ids"): IConnectionState[]| string[];
}