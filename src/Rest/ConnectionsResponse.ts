export interface IConnectionsResponse {
    connections: IConnectionState[] | String;
}

export interface IConnectionState {
    id: string,
    nick: string,
    channels: string[],
    mode: string,
}