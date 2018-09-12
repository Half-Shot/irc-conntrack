import { expect } from "chai";
import { IrcUtil } from "../../src/Irc/IrcUtil";
import { getDefaultSupported } from "../../src/Irc/IrcSupported";

describe("IrcUtil", () => {
    describe("casemap", () => {
        const supported = getDefaultSupported();
        supported.casemapping = "ascii";
        it("should not map case if message contains no arguments", () => {
            const msg = {args: []};
            IrcUtil.casemap(msg, 1, supported);
            expect(msg.args).to.be.empty;
        });
        it("should not map case if message doesn't contain index", () => {
            const msg = {args: ["#aPPle"]};
            IrcUtil.casemap(msg, 1, supported);
            expect(msg.args[0]).to.equal("#aPPle");
        });
        it("should not map case if arg doesn't begin with a #", () => {
            const msg = {args: ["aPPle"]};
            IrcUtil.casemap(msg, 1, supported);
            expect(msg.args[0]).to.equal("aPPle");
        });
        it("should map case", () => {
            const msg = {args: ["#aPPLE"]};
            IrcUtil.casemap(msg, 0, supported);
            expect(msg.args[0]).to.equal("#apple");
        });
    });
    describe("toLowerCase", () => {
        it("should not change case if format not known", () => {
            const supported = getDefaultSupported();
            supported.casemapping = "abcdef";
            expect(IrcUtil.toLowerCase("SomeMessage[]^\\", supported)).equals("SomeMessage[]^\\");
        });
        it("should change case if format is known", () => {
            const supported = getDefaultSupported();
            supported.casemapping = "rfc1459";
            expect(IrcUtil.toLowerCase("SomeMessage", supported)).equals("somemessage");
        });
        it("should support ascii", () => {
            const supported = getDefaultSupported();
            supported.casemapping = "ascii";
            expect(IrcUtil.toLowerCase("SomeMessage[]^\\", supported)).equals("somemessage[]^\\");
        });
        it("should support rfc1459", () => {
            const supported = getDefaultSupported();
            supported.casemapping = "rfc1459";
            expect(IrcUtil.toLowerCase("SomeMessage[]^\\", supported)).equals("somemessage{}~|");
        });
        it("should support strict-rfc1459", () => {
            const supported = getDefaultSupported();
            supported.casemapping = "strict-rfc1459";
            expect(IrcUtil.toLowerCase("SomeMessage[]^\\", supported)).equals("somemessage{}^|");
        });
    });
});
