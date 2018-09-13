import { expect } from "chai";
import * as Mock from "mock-require";
import { IrcConnectionOpts } from "../src/Irc/IrcClient";

class MockIrcClient {
    public channels: string[] = ["foo", "bar"];
    public usermode: string = "usermode";
    public nickname: string;
    constructor(public uuid: string, opts: IrcConnectionOpts) {
        /* stub */
        this.nickname = opts.nicknames as string;
    }

    public on() {
        /* stub */
    }

    public initiate(): Promise<void> {
        return Promise.resolve();
    }
}

Mock("../src/Irc/IrcClient",
    {
        IrcClient: MockIrcClient,
});

import { ConnectionTracker } from "../src/ConnectionTracker";
import { ConfigServer } from "../src/Config";
import { IConnectionState } from "../src/Rest/IConnectionsResponse";

let wsHooks: any = {};

const createConnectionTracker = async (createClients: number = 0) => {
    wsHooks = {};
    const t = new ConnectionTracker({
        serverConfig: () => {
            return new ConfigServer({
                name: "foo",
                addresses: ["127.0.0.1:1111"],
            });
        },
    } as any, {
        on: (name: string, func: () => void) => {
            wsHooks[name] = func;
        },
    } as any);
    for (let i = 0; i < createClients; i++) {
        await t.openConnection("foo", {
            nicknames: `GoodDog#${i}`,
            connectionTimeout: -1,
            detectEncoding: false,
            stripColors: false,
            ignoreBadMessages: false,
        });
    }
    return t;
}

describe("ConnectionTracker", () => {
    describe("constructor", () => {
        it("should construct", () => {
            createConnectionTracker();
        });
    });
    describe("getConnectionsForServer", () => {
        it("should return empty if no connections exist", async () => {
            const t = await createConnectionTracker();
            expect(t.getConnectionsForServer("foo", "ids")).to.be.empty;
        });
        it("should return ids", async () => {
            const N_CLIENTS = 3;
            const t = await createConnectionTracker(N_CLIENTS);
            expect(t.getConnectionsForServer("foo", "ids")).to.have.lengthOf(N_CLIENTS);
        });
        it("should return state", async () => {
            const N_CLIENTS = 3;
            const t = await createConnectionTracker(N_CLIENTS);
            const connections = t.getConnectionsForServer("foo", "state") as IConnectionState[];
            expect(connections).to.have.lengthOf(N_CLIENTS);
            const nicks = connections.map((c) => c.nick);
            expect(nicks).to.contain("GoodDog#0");
            expect(nicks).to.contain("GoodDog#1");
            expect(nicks).to.contain("GoodDog#2");
            expect(connections[0].channels).to.contain("foo");
            expect(connections[0].channels).to.contain("bar");
            expect(connections[0].mode).to.be.equal("usermode");
        });
        it("should throw if detail is not supported", async () => {
            const t = await createConnectionTracker();
            expect(() => {t.getConnectionsForServer("foo", "invaliddetail"); }).to.throw();
        });
    });
});
