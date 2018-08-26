export class Config {
    private servers: Map<string,any>;

    constructor() {
        this.servers = new Map();
        this.servers.set("test", new ConfigServer());
    }

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

    public get logging(): ConfigLogging {
        return new ConfigLogging();
    }

    public serverConfig(server: string): ConfigServer {
        return this.servers.get(server);
    }
}

export class ConfigServer {
    public get addresses(): string[] {
        return ["localhost:6667"]
    }

    public get addressTuple(): {port: number, host: string}[] {
        return this.addresses.map((addr) => {
            let split = addr.split(":",2);
            return {
                host: split[0],
                port: Number.parseInt(split[1]),
            };
        });
    }
}


export class ConfigLogging {
    public get lineDateFormat(): string {
        return "";
    }

    public get console(): string {
        return "verbose";
    }
}