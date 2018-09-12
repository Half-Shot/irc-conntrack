import * as Chai from "chai";
import * as ChaiAsPromised from "chai-as-promised";
Chai.use(ChaiAsPromised);
const expect = Chai.expect;

import { IrcClient } from "../../src/Irc/IrcClient";
import { ConfigServer } from "../../src/Config";
import { Log } from "../../src/Log";
import { MockIrcd } from "../Mocks/MockIrcd";

const MOCK_SERVER: ConfigServer = new ConfigServer({
    name: "mockserver",
    addresses: ["localhost:5544"],
    ipv6: false
});

let listener = new MockIrcd();
let client: IrcClient|null;

describe("IrcClient", () => {

    beforeEach(() => {
        client = null;
    });

    afterEach(() => {
        if (client !== null) {
            client.destroy();
        }
        listener.spinDown();
    })

    describe("constructor", () => {
        it("should construct", () => {
            client = new IrcClient("some-uuid", {
                nicknames: "myname",
                stripColors: false,
                connectionTimeout: 0,
                detectEncoding: false,
            });
        });
    });
    describe("initalise", () => {
        it("should fail to connect to a missing server", () => {
            client = new IrcClient("some-uuid", {
                nicknames: "myname",
                stripColors: false,
                connectionTimeout: 0,
                detectEncoding: false,
            });
            return expect(client.initiate(MOCK_SERVER)).to.eventually.be.rejectedWith("connect ECONNREFUSED 127.0.0.1:5544");
        });
        it("should connect", async function() {
            await listener.spinUp();
            client = new IrcClient("some-uuid", {
                nicknames: "myname",
                stripColors: false,
                connectionTimeout: 0,
                detectEncoding: false,
            });
            await client.initiate(MOCK_SERVER);
            await listener.waitForData(1, 500);
            expect(listener.connections).to.equal(1);
            expect(listener.dataRecieved).to.equal(":CONNECT hello!\n\r\n");
        }); 
    });
});
