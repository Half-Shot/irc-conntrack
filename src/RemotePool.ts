import { IClientPool } from "./IClientPool";
import {RequestAPI, RequestResponse} from "request";
import {defaults, RequestPromiseOptions, RequestPromise} from "request-promise-native";
import {StatusCodeError} from "request-promise-native/errors";
import * as Ws from "ws";
import request = require("request");
import { IVersions } from "./Rest/IVersions";


/**
 * Implements a pool interface to a remote irc-conntrack service.
 */

export class RemotePool implements IClientPool {
    // tslint:disable-next-line:no-any
    private r: RequestAPI<RequestPromise<any>, RequestPromiseOptions, request.RequiredUriUrl>;

    constructor(baseUrl: string, token: string) {
        if (!baseUrl.endsWith("/_irc/") || !baseUrl.endsWith("/_irc")) {
            baseUrl += "/_irc/";
        }
        if (!baseUrl.endsWith("/")) {
            baseUrl += "/";
        }
        this.r = defaults({
            baseUrl,
            headers: {
                Authorization: `Bearer ${token}`,
            },
            json: true,
        });
    }

    public async start() {
        const version = (await this.r.get("versions")) as IVersions;
        // get state of current connections
    }

    public getClientById(servername: string, id: string) {
        this.r.get(`connections/${encodeURIComponent(servername)}/${id}`);
    }

    public getConnections(servername: string, detail: "state"|"ids" = "state") {
        return this.tracker.getConnectionsForServer(servername, detail);
    }
}
