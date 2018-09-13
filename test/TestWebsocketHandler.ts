import { expect } from "chai";
import * as Mock from "mock-require";
import { WebsocketHandler } from "../src/WebsocketHandler";
import { Config } from "../src/Config";

let config: Config;

const createWebsocketHandler = () => {
    config = Config.parseFile("./test/config.sample.yaml");

    return new WebsocketHandler(config);
};

describe("WebsockerHandler", () => {
    describe("constructor", () => {
        it("will construct", () => {
            createWebsocketHandler();
        });
    });
    describe("addConnection", () => {
        it("will add connection", (done) => {
            const handler = createWebsocketHandler();
            handler.on("connected", (host: string, connection: any) => {
                expect(host).to.be.equal("somehost");
                expect(connection.magicFlag).to.be.true;
                done();
            });
            handler.addConnection("somehost", {magicFlag: true} as any);
        });
        it("will drop previous connection", (done) => {
            const handler = createWebsocketHandler();
            let dropCounter = 0;
            handler.addConnection("somehost", {magicFlag: true, terminate: () => {}} as any);
            handler.on("dropping", () => {dropCounter++; });
            handler.on("dropped", () => {dropCounter++; });
            handler.once("connected", (host: string, connection: any) => {
                expect(host).to.be.equal("somehost");
                expect(connection.magicFlag).to.be.true;
                expect(dropCounter).to.be.equal(2);
                done();
            });
            handler.addConnection("somehost", {magicFlag: true} as any);
        });
        it("will drop first connection if hitting maximum", (done) => {
            const handler = createWebsocketHandler();
            handler.addConnection("host#1", {markedForDeath: true, terminate: () => {}} as any);
            handler.addConnection("host#2", {} as any);
            handler.addConnection("host#3", {} as any);
            handler.addConnection("host#4", {} as any);
            handler.addConnection("host#5", {} as any);

            handler.on("dropping", (host, conn) => {
                expect(host).to.be.equal("host#1");
                expect(conn.markedForDeath).to.be.true;
            });
            handler.on("dropped", (host) => {
                expect(host).to.be.equal("host#1");
            });
            handler.once("connected", (host: string, connection: any) => {
                expect(host).to.be.equal("somehost");
                expect(connection.magicFlag).to.be.true;
                done();
            });
            handler.addConnection("somehost", {magicFlag: true} as any);
        });
    });
});
