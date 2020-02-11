import { parseMessage } from "../../src/Irc/IMessage";
import { expect } from "chai";

const MESSAGE_WITH_TAGS = "@time=2019-07-30T12:53:10.000Z;msgid=550~1561424176~15218 " +
                          ":bob!~bob@123.456.789.0 PRIVMSG #matrix-test :hello";

describe("IMessage", () => {
    describe("parseMessage", () => {
        it("handle IRCv3 Message Tags", () => {
            const msg = parseMessage(MESSAGE_WITH_TAGS);
            expect(msg.badFormat).to.be.false;
            expect(msg.command).to.equal("PRIVMSG");
            expect(msg.tags).to.be.not.undefined;
            expect(msg.tags!.time).to.equal("2019-07-30T12:53:10.000Z");
            expect(msg.tags!.msgid).to.equal("550~1561424176~15218");
        });
    });
});
