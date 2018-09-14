import { IrcState } from "../Irc/IrcState";

export interface IConnectionsResponse {
    connections: IConnectionState[] | string[];
}

export interface IConnectionState extends IrcState {
    id: string;
}
