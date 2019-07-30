import { IrcConnectionOpts } from "../Irc/IrcClient";
import { TrackedClient } from "./TrackedClient";

/**
 * This interface is shared between remote and local
 * conntrack clients.
 */
export interface IConntrackClient {
    getTrackedClient(server: string, id: string, connectionOpts?: IrcConnectionOpts): Promise<TrackedClient|null>;
}
