import { expect } from "chai";
import * as Mock from "mock-require";
import { WebsocketHandler, IWsIrcMessage } from "../src/WebsocketHandler";
import { Config } from "../src/Config";
import { fail } from "assert";
import {IWsCommand} from "../src/WebsocketCommands";

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
    describe("onIrcMessage", () => {
        it("will broadcast to all open connctions", () => {
            const EXPECTED_LEN = 5;
            const msgs: IWsIrcMessage[] = [];
            const conn = {send: (msg: IWsIrcMessage) => msgs.push(msg)};
            const handler = createWebsocketHandler();
            handler.addConnection("host#1", conn as any);
            handler.addConnection("host#2", conn as any);
            handler.addConnection("host#3", conn as any);
            handler.addConnection("host#4", conn as any);
            handler.addConnection("host#5", conn as any);
            handler.onIrcMessage("raw", "0000-1111", {rawCommand: "hot"} as any);
            expect(msgs).to.have.lengthOf(EXPECTED_LEN);
            msgs.forEach((msg) =>  {
                expect(msg.msg.rawCommand).to.equal("hot");
                expect(msg.event).to.equal("raw");
                expect(msg.client_id).to.equal("0000-1111");
            });
        });
    });
    describe("onMessage", () => {
        it("will emit valid messages", (done) => {
            const msgs: IWsIrcMessage[] = [];
            const conn = {onmessage: (e: {data: any, type: string, target: any}) => {}};
            const handler = createWebsocketHandler();
            handler.addConnection("host#1", conn as any);
            handler.once("command", () => {
                done();
            });
            const srcMsg = {client_id: "0000-1111", type: "raw", content: "hi", id: "42"} as IWsCommand;
            conn.onmessage({data: JSON.stringify(srcMsg), type: "type", target: null});
        });
        it("will not emit invalid message (json fail)", () => {
            const msgs: IWsIrcMessage[] = [];
            const conn = {onmessage: (e: {data: any, type: string, target: any}) => {}};
            const handler = createWebsocketHandler();
            handler.addConnection("host#1", conn as any);
            handler.once("command", () => {
                fail("Should not emit");
            });
            conn.onmessage({data: "foo", type: "type", target: null});
        });
        it("will not emit invalid message (invalid keys)", () => {
            const msgs: IWsIrcMessage[] = [];
            const conn = {onmessage: (e: {data: any, type: string, target: any}) => {}};
            const handler = createWebsocketHandler();
            handler.addConnection("host#1", conn as any);
            handler.once("command", () => {
                fail("Should not emit");
            });
            [
                {client_id: "0000-1111", type: true, content: "hi", id: "42"},
                {client_id: "0000-1111", type: "raw", content: undefined, id: "42"},
                {client_id: "0000-1111", type: "raw", content: "hi", id: 5},
                {client_id: undefined, type: "raw", content: "hi", id: 5},
            ].forEach((msg) => conn.onmessage({data: JSON.stringify(msg), type: "", target: null}));
        });
    });
});
