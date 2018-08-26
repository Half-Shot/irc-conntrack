export class ICConfig {
    public get bindAddress(): string {
        return "127.0.0.1";
    }

    public get bindPort(): number {
        return 9000;
    }

    public get backlogLimit(): number {
        return 10;
    }

    public get maximumWebsocketConnections(): number {
        return 5;
    }

    public get accessToken(): string {
        return "c3RyaW5nIDMwIGNoYXJhY3RlcnM=";
    }
}