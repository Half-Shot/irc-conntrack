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
        nicknames: ["myname", "nextname", "finalname"],
        realname: "Mr Foo",
        username: "foouser",
        stripColors: false,
        connectionTimeout: 0,
        detectEncoding: false,
        ignoreBadMessages: true,
        sasl: false,
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
            try {
                await listener.spinUp();
                client = createClient();
                await client.initiate(MOCK_SERVER);
                await listener.waitForData(1);
            } catch (e) {
                /* NOTE: This sometimes fails and I'm trying to work out why. */
                throw e;
            }
            expect(listener.connections).to.equal(1);
            expect(listener.dataRecieved).to.equal(
                "CAP REQ message-tags\r\nCAP REQ echo-message\r\nNICK myname\r\nUSER foouser 8 * :Mr Foo\r\n"
            );
        });
    });
    describe("onData", () => {
        beforeEach(() => {
            return listener.spinUp();
        });
        it("should handle simple PING messages", () => {
            client = createClient();
            client.initiate(MOCK_SERVER).then(() => {
                listener.send(":irc.example.com PING :LAG1537227775684\r\n");
            });

            return listener.waitForData(1, 2000).then(() => {
                const msgs = listener.dataRecieved.split("\r\n");
                return expect(msgs.includes("PONG LAG1537227775684")).to.be.true;
            });
        });
        it("should handle a PING splt into chunks", () => {
            const MSG_DELAY = 250;
            client = createClient();

            const p = new Promise((resolve) => {
                (client as IrcClient).msgEmitter.once("ping", resolve);
            });
            client.initiate(MOCK_SERVER).then(() => {
                return listener.send(":irc.halfy.net PING ");
            }).then(() => {
                return new Promise((resolve) => setTimeout(resolve, MSG_DELAY));
            }).then(() => {
                return listener.send(":LAG153");
            }).then(() => {
                return listener.send("6718080540\r\n");
            });
            return p;
        });
        it("should error on exceeding buffer", () => {
            const c = client = createClient();
            const FILL_SIZE = 1024 * 16;
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
                c.on("raw", reject);
                c.on("badformat", resolve);
            });
            client.initiate(MOCK_SERVER).then(() => {
                listener.send("   weeee\r\n");
            });
            return msgPromise.then((msg: IMessage) => {
                return expect(msg.badFormat).to.be.true;
            });
        });
    });
    describe("onNeedNewNick", () => {
        beforeEach(async () => {
            listener.spinUp();
            client = createClient();
            await client.initiate(MOCK_SERVER);
        });
        it("should change nick by cycling nicks", () => {
            const EXPECTED_LL = 492;
            if (client === null ) { return; }
            client.msgEmitter.emit("nickname_in_use");
            expect(client.ircState.nick).to.equal("nextname");
            expect(client.ircState.maxLineLength).to.equal(EXPECTED_LL);
        });
        it("should throw if no more nicks", () => {
            if (client === null ) { return; }
            const c = client;
            client.msgEmitter.emit("nickname_in_use");
            expect(client.ircState.nick).to.equal("nextname");
            client.msgEmitter.emit("nickname_in_use");
            expect(client.ircState.nick).to.equal("finalname");
            expect(() => {c.msgEmitter.emit("nickname_in_use"); }).to.throw;
        });
    });
});
