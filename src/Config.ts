/* istanbul ignore file */
import * as Yaml from 'js-yaml';
import * as fs from 'fs';
import { Log } from "./Log";

let log:Log;

export class Config {
    private servers: Map<string,any>;

    private constructor(private doc: any) {
        if (!log) {
            log = new Log("Config");
        }

        this.servers = new Map();
        this.validateDocument();
        this.doc.servers.forEach((serverDoc: any) => {
            const server = new ConfigServer(serverDoc);
            this.servers.set(serverDoc.name, server);
        });
    }

    public static parseFile(filename: string): Config {
        if (!log) {
            log = new Log("Config");
        }

        const contents = fs.readFileSync(filename, 'utf-8');
        log.info(`Read from ${filename}`);
        return Config.parseYaml(contents);
    }

    public static parseYaml(yamlString: string): Config {
        if (!log) {
            log = new Log("Config");
        }

        return new Config(Yaml.load(yamlString));
    }

    private validateDocument() {
        if (this.doc["servers"] === undefined || this.doc.servers.length < 1) {
            throw new Error("'servers' is empty or not defined.");
        }
        if (!this.doc["access-token"]) {
            throw new Error("'access-token' is not defined.");
        }
    }

    public setOption(key: string, value: string|number) {
        log.info(`Set ${key}=${value} from cli args`);
        try {
            // TODO: Take out this hack!
            value = parseInt(value as string, 10);
        } catch {}
        this.doc[key] = value;
    }

    public get bindAddress(): string {
        return this.doc["bind-address"] || "127.0.0.1";
    }

    public get bindPort(): number {
        return this.doc["bind-port"] || 9000;
    }

    public get backlogLimit(): number {
        return this.doc["rest-backlog-limit"] || 10;
    }

    public get maximumWebsocketConnections(): number {
        return this.doc["max-ws-connections"] || 5;
    }

    public get accessToken(): string {
        return this.doc["access-token"];
    }

    public get logging(): ConfigLogging {
        return new ConfigLogging();
    }

    public serverConfig(server: string): ConfigServer {
        return this.servers.get(server);
    }
}

export class ConfigServer {
    constructor(private doc: any) {
        this.validateDocument();
    }

    private validateDocument() {
        if (this.doc["addresses"] === undefined || this.doc.addresses.length < 1) {
            throw new Error(`${this.doc.name}.addresses is empty or not defined`);
        }
    }

    public get addresses(): string[] {
        return this.doc["addresses"];
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

    public get isIpv6(): boolean {
        return this.doc["ipv6"] || false;
    }

    public get maxConnections(): number {
        return this.doc["max-connections"] || 0;
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
