/* istanbul ignore file */
import * as Yaml from "js-yaml";
import * as fs from "fs";
import { Log } from "./Log";

let log: Log;

const PROTECTED_FIELDS = [
        "bind-address",
        "bind-port",
        "backlog-limit",
];

const DEFAULT_PORT = 9000;
const DEFAULT_BACKLOG = 10;
const DEFAULT_WS_CONNECTIONS = 5;

const DEFAULT_IRC_CLIENTS = 50;

export class Config {

    public get bindAddress(): string {
        return this.doc["bind-address"] || "127.0.0.1";
    }

    public get bindPort(): number {
        return Number.parseInt(this.doc["bind-port"]) || DEFAULT_PORT;
    }

    public get backlogLimit(): number {
        return Number.parseInt(this.doc["backlog-limit"]) || DEFAULT_BACKLOG;
    }

    public get maximumWebsocketConnections(): number {
        return Number.parseInt(this.doc["max-ws-connections"]) || DEFAULT_WS_CONNECTIONS;
    }

    public get accessToken(): string {
        return this.doc["access-token"];
    }

    public get logging(): ConfigLogging {
        return new ConfigLogging();
    }

    public get rawDocument(): any {
        return this.doc;
    }

    public get servers(): ConfigServer[] {
        return [...this.serverMap.values()];
    }

    public static parseFile(filename: string): Config {
        if (!log) {
            log = new Log("Config");
        }

        const contents = fs.readFileSync(filename, "utf-8");
        log.info(`Read from ${filename}`);
        return Config.parseYaml(contents, filename);
    }

    public static parseYaml(yamlString: string, filename?: string): Config {
        if (!log) {
            log = new Log("Config");
        }

        return new Config(Yaml.load(yamlString), filename);
    }
    private serverMap: Map<string, any>;

    private constructor(private doc: any, readonly filename?: string) {
        if (!log) {
            log = new Log("Config");
        }

        this.serverMap = new Map();
        this.validateDocument();
        this.doc.servers.forEach((serverDoc: any) => {
            const server = new ConfigServer(serverDoc);
            this.serverMap.set(serverDoc.name, server);
        });
    }

    public setOption(key: string, value: string|number) {
        log.info(`Set ${key}=${value}`);
        this.doc[key] = value;
    }

    public applyConfig(newCfg: Config) {
        const droppedServers = new Set([...this.serverMap.keys()]);
        newCfg.servers.forEach((server: ConfigServer) => {
            this.serverMap.set(server.name, server);
            droppedServers.delete(server.name);
        });
        droppedServers.forEach((dropped) => {
            this.serverMap.delete(dropped);
            log.warn(`Server '${dropped}' has been dropped from the config. No new connections can be made to it.`);
        });

        Object.keys(newCfg.rawDocument).forEach((key) => {
            if (key === "servers" || newCfg.rawDocument[key] === this.doc[key]) {
                return;
            }
            if (PROTECTED_FIELDS.includes(key)) {
                log.warn(`'${key}' requires a restart to update.`);
                return;
            }
            this.setOption(key, newCfg.rawDocument[key]);
        });
        log.info("Updated config with new values");
    }

    public serverConfig(server: string): ConfigServer {
        return this.serverMap.get(server);
    }

    private validateDocument() {
        if (this.doc.servers === undefined || this.doc.servers.length < 1) {
            throw new Error("'servers' is empty or not defined.");
        }
        if (!this.doc["access-token"]) {
            throw new Error("'access-token' is not defined.");
        }
    }
}

export class ConfigServer {
    constructor(private doc: any) {
        this.validateDocument();
    }

    private validateDocument() {
        if (this.doc.addresses === undefined || this.doc.addresses.length < 1) {
            throw new Error(`${this.doc.name}.addresses is empty or not defined`);
        }
    }

    public get name(): string {
        return this.doc.name;
    }

    public get addresses(): string[] {
        return this.doc.addresses;
    }

    public get addressTuple(): Array<{port: number, host: string}> {
        const SPLIT_N = 2;
        return this.addresses.map((addr) => {
            const split = addr.split(":", SPLIT_N);
            return {
                host: split[0],
                port: Number.parseInt(split[1]),
            };
        });
    }

    public get isIpv6(): boolean {
        return this.doc.ipv6 || false;
    }

    public get maxConnections(): number {
        return Number.parseInt(this.doc["max-connections"]) || DEFAULT_IRC_CLIENTS;
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
