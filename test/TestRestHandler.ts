import { expect } from "chai";
import * as Mock from "mock-require";
import * as HttpStatus from "http-status-codes";

let callbacks = {} as any;
let useFunctions: any[] = [];
let listenOpts: {port: number, address: string, backlog: number}|null = null;

const EXPECTED_CALLBACK_COUNT = 7;

const expressMock = (() => {
    return {
        get: (params: string, cb: () => void) => {
            callbacks["get:" + params] = cb;
        },
        post: (params: string, cb: () => void) => {
            callbacks["post:" + params] = cb;
        },
        ws: (params: string, cb: () => void) => {
            callbacks["ws:" + params] = cb;
        },
        listen: (port: number, address: string, backlog: number) => {
            listenOpts = {port, address, backlog};
        },
        use: (fn: () => void) => {
            useFunctions.push(fn);
        },
    };
}) as any;

expressMock.json = () => {};

Mock("express", expressMock);

Mock("express-ws", (app) => {
    return {
        app,
    };
});

import { RestHandler } from "../src/RestHandler";
import { ERRCODES, IErrorResponse } from "../src/Rest/IErrorResponse";
import { Config, ConfigServer } from "../src/Config";
import { IConnectionsResponse } from "../src/Rest/IConnectionsResponse";

const createRestHandler = (doc: any = {}, connTracker: any = {}) => {
    if (!doc.servers) {
        doc.servers = [new ConfigServer({
            name: "MockServer",
            addresses: ["127.0.0.1"],
        })];
    }
    if (!doc.access_token) {
        doc["access-token"] = "ValidToken";
    }
    doc.metrics = {enabled: false};
    return new RestHandler(connTracker, {} as any, Config.fromDoc(doc));
};

describe("RestHandler", () => {
    beforeEach(() => {
        callbacks = {};
        useFunctions = [];
    });
    describe("constructor", () => {
        it("should construct", () => {
            const c = createRestHandler();
        });
    });
    describe("configure", () => {
        it("should setup all handers", () => {
            const c = createRestHandler();
            c.configure();
            expect(Object.keys(callbacks)).to.have.lengthOf(EXPECTED_CALLBACK_COUNT);
        });
    });
    describe("listen", () => {
        it("should fail if configure was not called.", () => {
            const c = createRestHandler();
            expect(() => { c.listen(); }).to.throw();
        });
        it("should start listening", () => {
            const c = createRestHandler({
               "bind-address": "localhost",
               "bind-port": 1,
               "backlog-limit": 2,
            });
            c.configure();
            c.listen();
            if (listenOpts === null) {
                throw new Error("listenOpts was null");
            }
            expect(listenOpts.address).to.be.equal("localhost");
            expect(listenOpts.port).to.be.equal(1);
            expect(listenOpts.backlog).to.be.equal(2);
        });
    });
    describe("disconnectConnection", () => {
        it("should disconnect client", (done) => {
            let calledDisconnect = false;
            const c = createRestHandler({}, {
                getClient: () => {
                    return {
                        disconnect: (msg: string) => {
                            calledDisconnect = true;
                            return Promise.resolve();
                        },
                    };
                },
            });
            c.configure();
            callbacks["post:/_irc/connections/:server/:id/disconnect"]({
                query: { },
                params: {
                    server: "mockserver",
                    id: "0000-1111",
                },
            }, {
                send: () => {
                    done();
                },
            });
        });
        it("should report missing clients", (done) => {
            const c = createRestHandler({}, {
                getClient: () => {
                    return;
                },
            });
            c.configure();
            const res = {
                statusCode: -1,
                send: (err: IErrorResponse) => {
                    expect(err.errcode).to.equal(ERRCODES.clientNotFound);
                    expect(res.statusCode).to.equal(HttpStatus.NOT_FOUND);
                    done();
                },
            };
            callbacks["post:/_irc/connections/:server/:id/disconnect"]({
                query: { },
                params: {
                    server: "mockserver",
                    id: "0000-1111",
                },
            }, res);
        });
        it("should report failures to disconnect", (done) => {
            const c = createRestHandler({}, {
                getClient: () => {
                    return {
                        disconnect: (msg: string) => {
                            return Promise.reject("It went wrong");
                        },
                    };
                },
            });
            c.configure();
            const res = {
                statusCode: -1,
                send: (err: IErrorResponse) => {
                    expect(err.errcode).to.equal(ERRCODES.genericFail);
                    expect(res.statusCode).to.equal(HttpStatus.INTERNAL_SERVER_ERROR);
                    done();
                },
            };
            callbacks["post:/_irc/connections/:server/:id/disconnect"]({
                query: { },
                params: {
                    server: "mockserver",
                    id: "0000-1111",
                },
            }, res);
        });
    });
    describe("getConnections", () => {
        it("should get ids if no detail given", (done) => {
            const c = createRestHandler({}, {
                getConnectionsForServer: (server: string, detail: string) => {
                    expect(server).to.be.equal("MockServer");
                    expect(detail).to.be.equal("ids");
                    return ["apple", "custard-cream"];
                },
            });
            c.configure();
            callbacks["get:/_irc/connections/:server"]({
                query: { },
                params: {
                    server: "MockServer",
                },
            }, {
                send: (res: IConnectionsResponse) => {
                    expect(res.connections).to.have.lengthOf(2);
                    done();
                },
            });
        });
        it("should get state if detail given", (done) => {
            const c = createRestHandler({}, {
                getConnectionsForServer: (server: string, detail: string) => {
                    expect(server).to.be.equal("MockServer");
                    expect(detail).to.be.equal("state");
                    return ["fake", "street"];
                },
            });
            c.configure();
            callbacks["get:/_irc/connections/:server"]({
                query: { detail: "state" },
                params: {
                    server: "MockServer",
                },
            }, {
                send: (res: IConnectionsResponse) => {
                    expect(res.connections).to.have.lengthOf(2);
                    done();
                },
            });
        });
    });
    describe("readConfig", () => {
        it("should get the config", (done) => {
            const c = createRestHandler();
            c.configure();
            callbacks["get:/_irc/config"](undefined, {
                send: (config: any) => {
                    expect(config).to.not.be.undefined;
                    done();
                },
            });
        });
    });
    describe("updateConfig", () => {
        it("should fail if the config has no filename", (done) => {
            const c = createRestHandler();
            c.configure();
            const res = {
                statusCode: -1,
                send: (error: IErrorResponse) => {
                    expect(res.statusCode).to.be.equal(HttpStatus.LOCKED);
                    expect(error.errcode).to.be.equal(ERRCODES.genericFail);
                    done();
                },
            };
            callbacks["post:/_irc/config"](undefined, res);
        });
        it("should fail if the config is unparsable", (done) => {
            const c = new RestHandler({} as any, {} as any, {
                filename: "definitelynotafile",
                metrics: {
                    enabled: false
                },
            } as any);
            c.configure();
            const res = {
                statusCode: -1,
                send: (error: IErrorResponse) => {
                    expect(res.statusCode).to.be.equal(HttpStatus.INTERNAL_SERVER_ERROR);
                    expect(error.errcode).to.be.equal(ERRCODES.genericFail);
                    expect(error.error).contains("Config failed to parse");
                    done();
                },
            };
            callbacks["post:/_irc/config"](undefined, res);
        });
        it("should fail if the config could not be applied", (done) => {
            const c = new RestHandler({} as any, {} as any, {
                filename: "./test/config.sample.yaml",
                metrics: {
                    enabled: false
                },
                applyConfig : () => {
                    throw new Error("Test forced apply failure");
                },
            } as any);
            c.configure();
            const res = {
                statusCode: -1,
                send: (error: IErrorResponse) => {
                    expect(res.statusCode).to.be.equal(HttpStatus.INTERNAL_SERVER_ERROR);
                    expect(error.errcode).to.be.equal(ERRCODES.genericFail);
                    expect(error.error).contains("Config file could not be applied");
                    done();
                },
            };
            callbacks["post:/_irc/config"](undefined, res);
        });
        it("should apply new config", (done) => {
            const c = new RestHandler({} as any, {} as any, {
                rawDocument: {
                    magicFlag: true,
                },
                metrics: {
                    enabled: false,
                },
                filename: "./test/config.sample.yaml",
                applyConfig : (cfg: Config) => {
                    expect(cfg.accessToken).to.be.equal("foop");
                },
            } as any);
            c.configure();
            const res = {
                send: (doc: any) => {
                    expect(doc.magicFlag).to.be.true;
                    done();
                },
            };
            callbacks["post:/_irc/config"](undefined, res);
        });
    });
    describe("checkToken", () => {
        let c: RestHandler;
        beforeEach(() => {
            c = createRestHandler();
            c.configure();
        });
        it("should accept token from header", () => {
            return new Promise((resolve, reject) => {
                return useFunctions[2]({
                    header: (headerName: string) => {
                        expect(headerName).is.eq("Authorization");
                        return "Bearer ValidToken";
                    },
                }, {
                    send: reject,
                }, () => {resolve(); });
            });
        });
        it("should accept token from parameter", () => {
            return new Promise((resolve, reject) => {
                return useFunctions[2]({
                    header: (headerName: string) => {
                        return undefined;
                    },
                    query: {
                        access_token: "ValidToken",
                    },
                }, {
                    send: reject,
                }, () => {resolve(); });
            });
        });
        it("should not accept token if it is wrong, via header", () => {
            return new Promise((resolve, reject) => {
                return useFunctions[2]({
                    header: (headerName: string) => {
                        expect(headerName).is.eq("Authorization");
                        return "BadToken";
                    },
                }, {
                    send: resolve,
                }, () => {reject(); });
            }).then((res: any) => {
                expect(res.errcode).to.eq(ERRCODES.badToken);
            });
        });
        it("should not accept token if it is wrong, via query", () => {
            return new Promise((resolve, reject) => {
                return useFunctions[2]({
                    header: (headerName: string) => {
                        return undefined;
                    },
                    query: {
                        access_token: "BadToken",
                    },
                }, {
                    send: resolve,
                }, () => {reject(); });
            }).then((res: any) => {
                expect(res.errcode).to.eq(ERRCODES.badToken);
            });
        });
        it("should not accept if token is not given", () => {
            return new Promise((resolve, reject) => {
                return useFunctions[2]({
                    header: (headerName: string) => {
                        return undefined;
                    },
                    query: { },
                }, {
                    send: resolve,
                }, () => {reject(); });
            }).then((res: any) => {
                expect(res.errcode).to.eq(ERRCODES.missingToken);
            });
        });
    });
    describe("logRequest", () => {
        it("should forward on requests", (done) => {
            const c = createRestHandler();
            c.configure();
            useFunctions[1]({
                body: "somebody",
                hostname: "hostname",
                connection: {
                    remotePort: 42,
                },
                method: "GET",
                path: "/a/path",
                query: { a: "parameter"},
            }, {}, done);
        });
    });
});
