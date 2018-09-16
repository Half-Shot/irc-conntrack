/* tslint:disable:no-magic-numbers */
import { MessageParser } from "../../src/Irc/MessageParser";
import { IrcState, IChannel } from "../../src/Irc/IrcState";
import { getDefaultSupported, IIrcSupported } from "../../src/Irc/IrcSupported";
import { parseMessage } from "../../src/Irc/IMessage";
import { expect } from "chai";
import { INotice } from "../../src/Irc/Messages/INotice";
import { IMode } from "../../src/Irc/Messages/IMode";
import { INick } from "../../src/Irc/Messages/INick";

const RPL_WELCOME_SRC = parseMessage(
    ":example.com 001 Halfyyy :Welcome to the network! Halfyyy!halfy@11.22.111.3\r\n",
);

const RPL_SUPPORT = [
    parseMessage(":example.com 005 Halfyyy UHNAMES NAMESX SAFELIST HCN MAXCHANNELS=40 CHANLIMIT=#:40 " +
                "MAXLIST=b:600,e:600,I:600 MAXNICKLEN=30 NICKLEN=30 CHANNELLEN=32 TOPICLEN=307 KICKLEN=307 " +
                "AWAYLEN=307 :are supported by this server\r\n"),
    parseMessage(":example.com 005 Halfyyy MAXTARGETS=20 WALLCHOPS WATCH=128 WATCHOPTS=A SILENCE=15 " +
                 "MODES=12 CHANTYPES=# PREFIX=(qaohv)~&@%+ CHANMODES=beI,kLf,l,psmntirzMQNRTOVKDdGPZSCc " +
                 "NETWORK=Foonetic CASEMAPPING=ascii EXTBAN=~,SOcaRrnqj ELIST=MNUCT :are supported by this server\r\n"),
    parseMessage(":example.com 005 Halfyyy STATUSMSG=~&@%+ EXCEPTS INVEX CMDS=USERIP,STARTTLS,KNOCK,DCCALLOW,MAP " +
                 "IDCHAN=!:5,#:10,&:15 TARGMAX=PRIVMSG:4,NOTICE:3 :are supported by this server\r\n"),
];

const RPL_MYINFO = parseMessage(
    ":example.com 004 Halfyyy example.com UnrealIRCd-4.0.9 iowrsxzdHtIRqpWGTSB lvhopsmntikraqbeIzMQNRTOVKDdGLPZSCcf",
);

const NOTICE = parseMessage(":Halfyyy!someuser@irc.example.com NOTICE #ircconntest :woop");
const NOTICE_CTCP = parseMessage(":Halfyyy!someuser@irc.example.com NOTICE #ircconntest :\u0001woopctcp\u0001");

const MODE_CHANNEL = parseMessage(":Halfyyy!someuser@irc.example.com MODE #ircconntest +M");
const MODE_CHANNEL_REMOVE = parseMessage(":Halfyyy!someuser@irc.example.com MODE #ircconntest -M");
const MODE_CHANNEL_USER = parseMessage(":Halfyyy!someuser@irc.example.com MODE #ircconntest +v othernick");
const MODE_CHANNEL_USER_REMOVE = parseMessage(":Halfyyy!someuser@irc.example.com MODE #ircconntest -v othernick");
const JOIN_CHANNEL = parseMessage(":Halfyyy!someuser@irc.example.com JOIN #ircconntest");
const NICK = parseMessage(":Halfyyy!someuser@irc.example.com NICK :NewNick");
const NICK_OTHER = parseMessage(":otherUser!someuser@irc.example.com NICK :NewNick");

let state: IrcState;
let supported: IIrcSupported;

const createMessageParser = () => {
    state = new IrcState();
    supported = getDefaultSupported();
    return new MessageParser(
        "0000-1111",
        state,
        supported,
    );
};

describe("MessageParser", () => {
    describe("handleMessage", () => {
        it("handle rpl_welcome", (done) => {
            const parser = createMessageParser();
            parser.on("registered", () => {
                expect(state.hostMask).to.equal("Halfyyy!halfy@11.22.111.3");
                expect(state.nick).to.equal("Halfyyy");
                done();
            });
            parser.actOnMessage(RPL_WELCOME_SRC);
        });
        it("handle rpl_myinfo, rpl_isupport", () => {
            const parser = createMessageParser();
            // Add some basic state.
            parser.actOnMessage(RPL_WELCOME_SRC);
            RPL_SUPPORT.forEach((msg) => parser.actOnMessage(msg));
            parser.actOnMessage(RPL_MYINFO);
            expect(supported.maxtargets.PRIVMSG).is.equal(4);
            expect(supported.maxtargets.NOTICE).is.equal(3);
            expect(supported.casemapping).is.equal("ascii");
            expect(supported.kicklength).is.equal(307);
            expect(supported.channel.limit["#"]).is.equal(40);
            expect(supported.channel.length).is.equal(32);
            expect(supported.maxlist.b).is.equal(600);
            expect(supported.maxlist.e).is.equal(600);
            expect(supported.maxlist.I).is.equal(600);
            expect(supported.nicklength).is.equal(30);
            expect(supported.topiclength).is.equal(307);
            expect(supported.channel.idlength["!"]).is.equal(5);
            expect(supported.channel.idlength["#"]).is.equal(10);
            expect(supported.channel.idlength["&"]).is.equal(15);
            expect(supported.channel.modes.a).is.equal("beI");
            expect(supported.channel.modes.b).is.equal("qaohvkLf");
            expect(supported.channel.modes.c).is.equal("l");
            expect(supported.channel.modes.d).is.equal("psmntirzMQNRTOVKDdGPZSCc");
            expect(supported.channel.types).is.equal("#");
            expect(supported.usermodes).is.equal("iowrsxzdHtIRqpWGTSB");
            expect(supported.usermodepriority).is.equal("qaohv");
            expect(supported.prefixForMode).is.deep.equal({ q: "~", a: "&", o: "@", h: "%", v: "+" });
            expect(supported.modeForPrefix).is.deep.equal({ "~": "q", "&": "a", "@": "o", "%": "h", "+": "v" });
        });
        it("handle NOTICE", (done) => {
            const parser = createMessageParser();
            parser.once("notice", (msg: INotice) => {
                expect(msg.isCTCP).is.false;
                expect(msg.text).is.equal("woop");
                expect(msg.from).is.equal("Halfyyy");
                expect(msg.to).is.equal("#ircconntest");
                done();
            });
            parser.actOnMessage(NOTICE);
        });
        it("handle ctcp NOTICE", (done) => {
            const parser = createMessageParser();
            parser.once("notice", (msgCtcp: INotice) => {
                expect(msgCtcp.isCTCP).is.true;
                expect(msgCtcp.text).is.equal("woopctcp");
                expect(msgCtcp.from).is.equal("Halfyyy");
                expect(msgCtcp.to).is.equal("#ircconntest");
                done();
            });
            parser.actOnMessage(NOTICE_CTCP);
        });
        it("handle channel MODE (without knowing the channel)", (done) => {
            const parser = createMessageParser();
            parser.once("mode", (modeMsg: IMode) => {
                expect(modeMsg.adding).is.true;
                expect(modeMsg.mode).is.equal("M");
                expect(modeMsg.channel).is.equal("#ircconntest");
                done();
            });
            parser.actOnMessage(MODE_CHANNEL);
        });
        it("handle channel MODE", (done) => {
            const parser = createMessageParser();
            parser.once("mode", (modeMsg: IMode) => {
                const chan = state.chans.get("#ircconntest") as IChannel;
                expect(chan).is.not.undefined;
                expect(modeMsg.adding).is.true;
                expect(modeMsg.mode).is.equal("M");
                expect(modeMsg.channel).is.equal("#ircconntest");
                expect(chan.mode.has("M")).is.true;
                parser.once("mode", (modeMsgRmv: IMode) => {
                    expect(chan).is.not.undefined;
                    expect(modeMsgRmv.adding).is.false;
                    expect(modeMsgRmv.mode).is.equal("M");
                    expect(modeMsgRmv.channel).is.equal("#ircconntest");
                    expect(chan.mode.has("M")).is.false;
                    done();
                });
                parser.actOnMessage(MODE_CHANNEL_REMOVE);
            });
            state.chanData("#ircconntest", true);
            parser.actOnMessage(MODE_CHANNEL);
        });
        it("handle user MODE", (done) => {
            const parser = createMessageParser();
            parser.once("mode", (modeMsg: IMode) => {
                expect(chan.users.othernick).is.not.undefined;
                expect(modeMsg.adding).is.true;
                expect(modeMsg.mode).is.equal("v");
                expect(modeMsg.channel).is.equal("#ircconntest");
                expect(modeMsg.affects).is.equal("othernick");
                expect(chan.users.othernick.has("+")).is.true;
                parser.once("mode", (modeMsgRmv: IMode) => {
                    expect(chan.users.othernick).is.not.undefined;
                    expect(modeMsgRmv.adding).is.false;
                    expect(modeMsgRmv.mode).is.equal("v");
                    expect(modeMsgRmv.channel).is.equal("#ircconntest");
                    expect(modeMsgRmv.affects).is.equal("othernick");
                    expect(chan.users.othernick.has("+")).is.false;
                    done();
                });
                parser.actOnMessage(MODE_CHANNEL_USER_REMOVE);
            });
            const chan = state.chanData("#ircconntest", true) as IChannel;
            chan.users.othernick = new Set();
            parser.actOnMessage(RPL_SUPPORT[1]);
            parser.actOnMessage(MODE_CHANNEL_USER);
        });
        it("handle user NICK (own nick)", (done) => {
            const parser = createMessageParser();
            parser.once("nick", (msg: INick) => {
                expect(msg.newNick, "NewNick");
                expect(state.nick, "NewNick");
                expect(state.maxLineLength).to.equal(493);
                expect(msg.channels).to.be.empty;
                done();
            });
            state.nick = "Halfyyy";
            parser.actOnMessage(NICK);
        });
        it("handle user NICK (other nick)", (done) => {
            const parser = createMessageParser();
            parser.once("nick", (msg: INick) => {
                expect(msg.nick, "otherUser");
                expect(msg.newNick, "NewNick");
                expect(msg.channels).to.contain("#chana");
                expect(msg.channels).to.contain("#chanb");
                done();
            });
            state.nick = "Halfyyy";
            const chanA = state.chanData("#chana", true) as IChannel;
            chanA.users.otherUser = new Set();
            const chanB = state.chanData("#chanb", true) as IChannel;
            chanB.users.otherUser = new Set();
            parser.actOnMessage(NICK_OTHER);
        });
    });
});
