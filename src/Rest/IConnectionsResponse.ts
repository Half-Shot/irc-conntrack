export interface IConnectionsResponse {
    connections: IConnectionState[] | string[];
}

export interface IConnectionState {
    id: string;
    nick: string;
    channels: string[];
    mode: string;
}
