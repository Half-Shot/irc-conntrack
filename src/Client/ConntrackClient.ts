import * as Ws from "ws";
import {Log} from "../../src/Log";
import {RequestAPI, RequestResponse, RequiredUriUrl} from "request";
import {defaults as rDefaults, RequestPromise, RequestPromiseOptions} from "request-promise-native";
import { EventEmitter } from "events";
import { IWsIrcMessage } from "../WebsocketHandler";
import { IWsCommand } from "../WebsocketCommands";
import { TrackedClient } from "./TrackedClient";
import { IErrorResponse } from "../Rest/IErrorResponse";
import { IConnectionState } from "../Rest/IConnectionsResponse";
import { IrcConnectionOpts } from "../Irc/IrcClient";
import { IConntrackClient } from "./IConntrackClient";

const log = new Log("ConntrackClient");

interface ConntrackClientConfig {
    url: string;
    accessToken: string;
}

export class ConntrackClient extends EventEmitter implements IConntrackClient {
    // We might return anything from request.
    // tslint:disable-next-line: no-any
    private request: RequestAPI<RequestPromise<any>, RequestPromiseOptions, RequiredUriUrl>;
    private trackedClients: Map<string, TrackedClient>;
    private client!: Ws;
    constructor(private config: ConntrackClientConfig) {
        super();
        this.request = rDefaults({
            baseUrl: config.url,
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
            },
            json: true,
        });
        this.trackedClients = new Map();
    }

    public async sendCommand(command: IWsCommand): Promise<void> {
        new Promise((resolve, reject) => {
            this.client.send(command, (err) => {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    }

    public async getTrackedClient(server: string, id: string, connectionOpts?: IrcConnectionOpts)
    : Promise<TrackedClient|null> {
        const client = this.trackedClients.get(`${server}:${id}`);
        if (client) {
            return client;
        }
        const res = await this.request.get(`/_irc/connections/${server}/${id}`);
        if (res.error === undefined) {
            // TODO: Farm state for info.
            const trackedClient = new TrackedClient(server, id);
            this.trackedClients.set(`${server}:${id}`, trackedClient);
            return trackedClient;
        }
        // TODO: Check this error means we can continue.
        if (!connectionOpts) {
            return null;
        }

        const openRes = await this.request.post(`/_irc/connections/${server}/open/${id}`, {
            body: connectionOpts,
        });
        if (openRes.id) {
            const trackedClient = new TrackedClient(server, openRes.id);
            this.trackedClients.set(`${server}:${id}`, trackedClient);
            return trackedClient;
        }
        throw Error(`Failed to create client: ${openRes.error}`);
    }

    public connect() {
        this.client = new Ws(`${this.config.url}/_irc/ws`, "irc-conntrack", {
            headers: {
                Authorization: `Bearer ${this.config.accessToken}`,
            },
        });

        this.client.once("open", () => {
            log.info("Connected");
        });

        this.client.once("close", (code, reason) => {
            log.error("Connection closed (", code, reason, ")");
            this.emit("error", new Error("Websocket closed"));
        });

        this.client.once("error", (e) => {
            log.error("Failed to connect ", e);
            this.emit("error", e);
        });

        this.client.once("unexpected-response", (req, res) => {
            log.verbose("On upgrade");
        });

        this.client.on("message", (dataStr) => {
            let msg: IWsIrcMessage;
            try {
                if (dataStr instanceof Buffer || dataStr instanceof ArrayBuffer) {
                    dataStr = dataStr.toString();
                }
                msg = JSON.parse(dataStr as string);
                this.emit(msg.event, msg.msg);
            } catch (e) {
                log.warn("Failed to parse WS message");
                return;
            }
        });
    }
}
