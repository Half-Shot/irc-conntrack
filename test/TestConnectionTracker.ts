import { expect } from "chai";
import * as Mock from "mock-require";
import { IrcConnectionOpts } from "../src/Irc/IrcClient";

class MockIrcClient {
    public usermode: string = "usermode";
    public ircState: IrcState;
    public msgEmitter = {
        on: () => { /* stub */ },
    };
    constructor(public uuid: string, opts: IrcConnectionOpts) {
        this.ircState = new IrcState();
        this.ircState.usermode = "usermode";
        this.ircState.nick = opts.nicknames as string;
    }

    public on() {
        /* stub */
    }

    public initiate() {
        return Promise.resolve();
    }

    public send(msg: string) {
        lastSentMessage = msg;
        return Promise.resolve();
    }
}

Mock("../src/Irc/IrcClient",
    {
        IrcClient: MockIrcClient,
});

import { ConnectionTracker } from "../src/ConnectionTracker";
import { ConfigServer, Config } from "../src/Config";
import { IConnectionState } from "../src/Rest/IConnectionsResponse";
import { IErrorResponse, ERRCODES } from "../src/Rest/IErrorResponse";
import { IrcState } from "../src/Irc/IrcState";

let wsHooks: any = {};
let config: Config;
let lastSentMessage: string;

const createConnectionTracker = async (createClients: number = 0) => {
    wsHooks = {};
    config = Config.parseFile("./test/config.sample.yaml");
    const t = new ConnectionTracker(
        config,
        {
            on: (name: string, func: () => void) => {
                wsHooks[name] = func;
            },
        } as any,
    );
    for (let i = 0; i < createClients; i++) {
        await t.openConnection("foo", {
            nicknames: `GoodDog#${i}`,
            username: "",
            realname: "",
            sasl: false,
            connectionTimeout: -1,
            detectEncoding: false,
            stripColors: false,
            ignoreBadMessages: false,
        });
    }
    return t;
};

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
            expect(connections[0].usermode).to.be.equal("usermode");
        });
        it("should throw if detail is not supported", async () => {
            const t = await createConnectionTracker();
            expect(() => {t.getConnectionsForServer("foo", "invaliddetail"); }).to.throw();
        });
    });
    describe("openConnection", () => {
        it("should reject if server is not known", async () => {
            const t = await createConnectionTracker();
            try {
                await t.openConnection("fakeserver", {
                    nicknames: `BadDog`,
                    username: "",
                    realname: "",
                    sasl: false,
                    connectionTimeout: -1,
                    detectEncoding: false,
                    stripColors: false,
                    ignoreBadMessages: false,
                });
            } catch (e) {
                expect((e as IErrorResponse).errcode).to.equal(ERRCODES.notInConfig);
                return;
            }
            throw new Error("Expected to throw");
        });
        it("should reject if over connection limit", async () => {
            const MAX_CLIENTS = 5;
            const t = await createConnectionTracker(MAX_CLIENTS);
            try {
                await t.openConnection("foo", {
                    nicknames: `BadDog`,
                    username: "",
                    realname: "",
                    sasl: false,
                    connectionTimeout: -1,
                    detectEncoding: false,
                    stripColors: false,
                    ignoreBadMessages: false,
                });
            } catch (e) {
                expect((e as IErrorResponse).errcode).to.equal(ERRCODES.connectionLimit);
                return;
            }
            throw new Error("Expected to throw");
        });
    });
    describe("runCommand", () => {
        it("should send error if client not found", async () => {
            const t = await createConnectionTracker();
            return new Promise((resolve) => {
                t.runCommand(
                    {client_id: "aaaa", content: "aaaa", type: "raw", id: "1"},
                    {
                        send: (jsonError: string) => {
                            expect(jsonError).to.be.equal(`{"id":"1","errcode":"IC_CLIENT_NOT_FOUND"}`);
                            resolve();
                        },
                    } as any,
                );
            });
        });
        it("should send error if the command is not understood", async () => {
            const t = await createConnectionTracker();
            return new Promise((resolve) => {
                t.runCommand(
                    {client_id: "aaaa", content: "aaaa", type: "badcommand", id: "1"},
                    {
                        send: (jsonError: string) => {
                            expect(jsonError).to.be.equal(`{"id":"1","errcode":"IC_COMMAND_NOT_RECOGNISED"}`);
                            resolve();
                        },
                    } as any,
                );
            });
        });
        it("should send raw command to client", async () => {
            const t = await createConnectionTracker(1);
            const clientId = t.getConnectionsForServer("foo", "ids")[0] as string;
            return new Promise((resolve) => {
                t.runCommand(
                    {client_id: clientId, content: "aaaa", type: "raw", id: "1"},
                    {} as any,
                );
                expect(lastSentMessage).to.equal("aaaa");
                resolve();
            });
        });
    });
});
