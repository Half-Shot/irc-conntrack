import * as Chai from "chai";
import * as ChaiAsPromised from "chai-as-promised";
Chai.use(ChaiAsPromised);
const expect = Chai.expect;

import { IrcClient } from "../../src/Irc/IrcClient";
import { ConfigServer } from "../../src/Config";
import { Log } from "../../src/Log";
import { MockIrcd } from "../Mocks/MockIrcd";
import { IMessage } from "../../src/Irc/IMessage";

const MOCK_SERVER: ConfigServer = new ConfigServer({
    name: "mockserver",
    addresses: ["localhost:5544"],
    ipv6: false,
});

let listener = new MockIrcd();
let client: IrcClient|null;

function createClient(): IrcClient {
    return new IrcClient("some-uuid", {
        nicknames: "myname",
        stripColors: false,
        connectionTimeout: 0,
        detectEncoding: false,
        ignoreBadMessages: true,
    });
}

describe("IrcClient", () => {

    beforeEach(() => {
        client = null;
    });

    afterEach(async () => {
        if (client !== null) {
            client.destroy();
            client = null;
        }
        await listener.spinDown();
        listener = new MockIrcd();
    });

    describe("constructor", () => {
        it("should construct", () => {
            client = createClient();
        });
    });
    describe("initalise", () => {
        it("should fail to connect to a missing server", () => {
            client = createClient();
            return expect(client.initiate(MOCK_SERVER)).to.eventually.be.rejectedWith(
                "connect ECONNREFUSED 127.0.0.1:5544",
            );
        });
        it("should connect", async () => {
            await listener.spinUp();
            client = createClient();
            await client.initiate(MOCK_SERVER);
            await listener.waitForData(1);
            expect(listener.connections).to.equal(1);
            expect(listener.dataRecieved).to.equal(":CONNECT hello!\n\r\n");
        });
    });
    describe("onData", () => {
        beforeEach(() => {
            return listener.spinUp();
        });
        it("should handle simple PONG messages", () => {
            const c = client = createClient();
            const msgPromise = new Promise((resolve, reject) => {
                c.on("raw", resolve);
            });
            client.initiate(MOCK_SERVER).then(() => {
                listener.send(":irc.halfy.net PONG irc.halfy.net :LAG1536718080540\r\n");
            });
            return msgPromise.then((msg) => {
                return expect(msg).to.not.be.undefined;
            });
        });
        it("should handle a PING splt into chunks", () => {
            const c = client = createClient();
            const msgPromise = new Promise((resolve, reject) => {
                c.on("raw", resolve);
            });
            client.initiate(MOCK_SERVER).then(() => {
                listener.send(":irc.halfy.net PONG ");
                listener.send("irc.halfy.net :LAG153");
                listener.send("6718080540\r\n");
            });
            return msgPromise.then((msg) => {
                return expect(msg).to.not.be.undefined;
            });
        });
        it("should error on exceeding buffer", () => {
            const c = client = createClient();
            const FILL_SIZE = 980;
            const msgPromise: Promise<Error> = new Promise((resolve, reject) => {
                c.on("raw", () => { reject(new Error("Expected an error")); });
                c.on("error", resolve);
            });
            client.initiate(MOCK_SERVER).then(() => {
                listener.send(":irc.halfy.net PO" + new Array(FILL_SIZE).join("O"));
                listener.send("NG irc.halfy.net :LAG153");
                listener.send("6718080540\r\n");
            });
            return msgPromise.then((msg: Error) => {
                expect(msg).to.equal("Buffer size limit reached for IRC message");
            });
        });
        it("should return a badFormat message", () => {
            const c = client = createClient();
            const msgPromise: Promise<IMessage> = new Promise((resolve, reject) => {
                c.on("raw", resolve);
                c.on("error", reject);
            });
            client.initiate(MOCK_SERVER).then(() => {
                listener.send("   weeee\r\n");
            });
            return msgPromise.then((msg: IMessage) => {
                return expect(msg.badFormat).to.be.true;
            });
        });
    });
});
