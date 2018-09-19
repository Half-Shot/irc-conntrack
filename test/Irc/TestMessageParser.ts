/* tslint:disable:no-magic-numbers */
import { MessageParser } from "../../src/Irc/MessageParser";
import { IrcState, IChannel } from "../../src/Irc/IrcState";
import { getDefaultSupported, IIrcSupported } from "../../src/Irc/IrcSupported";
import { parseMessage, IMessage } from "../../src/Irc/IMessage";
import { expect } from "chai";
import { INotice } from "../../src/Irc/Messages/INotice";
import { IMode } from "../../src/Irc/Messages/IMode";
import { INick } from "../../src/Irc/Messages/INick";
import { INames } from "../../src/Irc/Messages/INames";
import { ITopic } from "../../src/Irc/Messages/ITopic";
import { IJoin } from "../../src/Irc/Messages/IJoin";
import { IPart } from "../../src/Irc/Messages/IPart";
import { IKick } from "../../src/Irc/Messages/IKick";
import { parse } from "url";
import { IQuit } from "../../src/Irc/Messages/IQuit";
import { IInvite } from "../../src/Irc/Messages/IInvite";
import { ISupports } from "../../src/Irc/Messages/ISupports";
import { define } from "mime";
import { REQUEST_HEADER_FIELDS_TOO_LARGE } from "http-status-codes";
import { parseTwoDigitYear } from "moment";

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
const NOTICE_CTCP = parseMessage(":otherUser!someuser@irc.example.com NOTICE Halfyyy :\u0001woopctcp\u0001");

const MODE_CHANNEL = parseMessage(":Halfyyy!someuser@irc.example.com MODE #ircconntest +M");
const MODE_CHANNEL_REMOVE = parseMessage(":Halfyyy!someuser@irc.example.com MODE #ircconntest -M");
const MODE_CHANNEL_USER = parseMessage(":Halfyyy!someuser@irc.example.com MODE #ircconntest +v othernick");
const MODE_CHANNEL_USER_REMOVE = parseMessage(":Halfyyy!someuser@irc.example.com MODE #ircconntest -v othernick");
const MODE_IS = parseMessage(":irc.example.com 324 Halfyyy #ircconntest MvT");
const NICK = parseMessage(":Halfyyy!someuser@irc.example.com NICK :NewNick");
const NICK_OTHER = parseMessage(":otherUser!someuser@irc.example.com NICK :NewNick");

const NAMES_START = parseMessage(":example.com 353 Halfa = #ircconntest " +
                        ":+HalfyyyTwo!someuser@irc.example.com " +
                        "@Halfa!someuser@irc.example.com");
const NAMES_END = parseMessage(":example.com 366 Halfa #ircconntest :End of /NAMES list.");
const TOPIC = parseMessage(":Halfyyy!someuser@irc.example.com TOPIC #ircconntest :Neat topic :P");
const RPL_TOPIC = parseMessage(":example.com 332 otherUser #ircconntest :Neat topic :P");
const RPL_TOPIC_WHOTIME = parseMessage(":example.com 333 otherUser #ircconntest someUser 11111");
const JOIN_CHANNEL = parseMessage(":Halfyyy!someuser@irc.example.com JOIN #ircconntest");
const JOIN_CHANNEL_OTHER = parseMessage(":otherUser!other@irc.example.com JOIN #ircconntest");

const PART_CHANNEL = parseMessage(":Halfyyy!someuser@irc.example.com PART #ircconntest :Some excuse");
const PART_CHANNEL_OTHER = parseMessage(":otherUser!other@irc.example.com PART #ircconntest :Some excuse");

const KICK_CHANNEL = parseMessage(":Halfyyy!someuser@irc.example.com KICK #ircconntest Halfyyy :Bad breath");
const KICK_CHANNEL_OTHER = parseMessage(":Halfyyy!other@irc.example.com KICK #ircconntest otherUser :Bad breath");

const PRIVMSG = parseMessage(":Halfyyy!other@irc.example.com PRIVMSG #ircconntest :Hello!");
const PRIVMSG_CTCP = parseMessage(":otherUser!other@irc.example.com PRIVMSG Halfyyy :\u0001Hello!\u0001");
const KILL = parseMessage(":otherUser!other@irc.example.com KILL Halfyyy :Death by doggo!");
const QUIT = parseMessage(":Halfyyy!someuser@irc.example.com QUIT :Death by doggo!");

const INVITE = parseMessage(":otherUser!other@irc.example.com INVITE Halfyyy :#ircconntest");
const RPL_SUPPORTS_SASL = parseMessage(":irc.example.com CAP * ACK :sasl");

const ERRONEUS_NICK = parseMessage(":irc.example.com 432");

const MOTD_MESSAGES = [
    "375 HalfyyyTwo :Halfy is a",
    "372 HalfyyyTwo :very",
    "372 HalfyyyTwo :very",
    "376 HalfyyyTwo :good boy!",
].map((cmd: string) => parseMessage(`:irc.example.com ${cmd}`));

const USELESS_MSGS: IMessage[] = [
    "rpl_yourhost",
    "rpl_created",
    "rpl_luserclient",
    "rpl_luserop",
    "rpl_luserchannels",
    "rpl_luserme",
    "rpl_localusers",
    "rpl_globalusers",
    "rpl_statsconn",
    "rpl_luserunknown",
].map((cmd: string) => parseMessage(`:irc.example.com ${cmd}`));

const WHOIS_LIST: IMessage[] = [
    "311 Halfyyy Halfyyy will example.host * :realname",
    "379 Halfyyy Halfyyy :is using modes +iwx",
    "378 Halfyyy Halfyyy :is connecting from *@example.host 12.34.567.890",
    "319 Halfyyy Halfyyy :#ircconntest",
    "312 Halfyyy Halfyyy irc.example.com :HalfyNET",
    "301 Halfyyy Halfyyy :awaymsg",
    "317 Halfyyy Halfyyy 676 1537276594 :seconds idle, signon time",
    "318 Halfyyy Halfyyy :End of /WHOIS list.",
].map((cmd: string) => parseMessage(`:irc.example.com ${cmd}`));

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
                expect(msgCtcp.from).is.equal("otherUser");
                expect(msgCtcp.to).is.equal("Halfyyy");
                done();
            });
            parser.actOnMessage(NOTICE_CTCP);
        });
        describe("nicks", () => {
            it("handle NICK (own)", (done) => {
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
            it("handle NICK (other)", (done) => {
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
        it("handle NAMES", (done) => {
            const parser = createMessageParser();
            state.chanData("#ircconntest", true) as IChannel;
            parser.once("names", (msg: INames) => {
                expect(msg.channel).to.equal("#ircconntest");
                expect(Object.keys(msg.users)[0]).to.equal("+HalfyyyTwo!someuser@irc.example.com");
                expect(Object.keys(msg.users)[1]).to.equal("@Halfa!someuser@irc.example.com");
                expect(Object.keys(msg.users)).to.have.lengthOf(2);
                done();
            });
            parser.actOnMessage(NAMES_START);
            parser.actOnMessage(NAMES_END);
        });
        describe("modes", () => {
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

            it("handle user MODE", (done) => {
                const parser = createMessageParser();
                const chan = state.chanData("#ircconntest", true) as IChannel;
                parser.once("mode_is", (modeMsg: IMode) => {
                    expect(modeMsg.channel).is.equal("#ircconntest");
                    expect(modeMsg.mode).is.equal("MvT");
                    expect([...chan.mode].join("")).is.equal("MvT");
                    done();
                });
                parser.actOnMessage(MODE_IS);
            });
        });
        describe("topics", () => {
            it("handle rpl_topic", () => {
                const parser = createMessageParser();
                const chan = state.chanData("#ircconntest", true) as IChannel;
                parser.actOnMessage(RPL_TOPIC);
                expect(chan.topic).to.equal("Neat topic :P");
            });
            it("handle rpl_topicwhotime", () => {
                const parser = createMessageParser();
                const chan = state.chanData("#ircconntest", true) as IChannel;
                parser.actOnMessage(RPL_TOPIC_WHOTIME);
                expect(chan.topicBy).to.equal("someUser");
                // TODO: Check for time.
            });
            it("handle TOPIC", (done) => {
                const parser = createMessageParser();
                const chan = state.chanData("#ircconntest", true) as IChannel;
                parser.once("topic", (msg: ITopic) => {
                    expect(msg.channel).to.equal("#ircconntest");
                    expect(msg.topic).to.equal("Neat topic :P");
                    expect(msg.topicBy).to.equal("Halfyyy");
                    expect(chan.topic).to.equal("Neat topic :P");
                    expect(chan.topicBy).to.equal("Halfyyy");
                    done();
                });
                parser.actOnMessage(TOPIC);
            });
        });
        describe("joins", () => {
            it("handle own JOIN", (done) => {
                const parser = createMessageParser();
                parser.once("join", (msg: IJoin) => {
                    expect(msg.channel).to.equal("#ircconntest");
                    expect(msg.nick).to.equal("Halfyyy");
                    expect(state.chans.has("#ircconntest")).to.be.true;
                    const chan = state.chanData("#ircconntest") as IChannel;
                    expect(chan.users.Halfyyy).to.exist;
                    done();
                });
                parser.actOnMessage(RPL_WELCOME_SRC);
                parser.actOnMessage(JOIN_CHANNEL);
            });
            it("handle other user's (no chan)", () => {
                const parser = createMessageParser();
                let hasEmitted = false;
                parser.once("join", (msg: IJoin) => {
                    expect(msg.channel).to.equal("#ircconntest");
                    expect(msg.nick).to.equal("otherUser");
                    hasEmitted = true;
                });
                parser.actOnMessage(RPL_WELCOME_SRC);
                parser.actOnMessage(JOIN_CHANNEL_OTHER);
                expect(state.chans.has("#ircconntest")).to.be.false;
                expect(hasEmitted).to.be.true;
            });
            it("handle other user's (w/ chan)", (done) => {
                const parser = createMessageParser();
                const chan = state.chanData("#ircconntest", true) as IChannel;
                parser.once("join", (msg: IJoin) => {
                    expect(msg.channel).to.equal("#ircconntest");
                    expect(msg.nick).to.equal("otherUser");
                    expect(chan.users.otherUser).to.exist;
                    done();
                });
                parser.actOnMessage(RPL_WELCOME_SRC);
                parser.actOnMessage(JOIN_CHANNEL_OTHER);
            });
        });
        describe("parts", () => {
            it("handle own PART", () => {
                let firedEvent = false;
                const parser = createMessageParser();
                state.chanData("#ircconntest", true) as IChannel;
                parser.once("part", (msg: IPart) => {
                    expect(msg.channel).to.equal("#ircconntest");
                    expect(msg.nick).to.equal("Halfyyy");
                    expect(msg.reason).to.equal("Some excuse");
                    firedEvent = true;
                });
                parser.actOnMessage(RPL_WELCOME_SRC);
                parser.actOnMessage(PART_CHANNEL);
                expect(state.chans.has("#ircconntest")).to.be.false;
                expect(firedEvent).to.be.true;
            });
            it("handle other PART (no chan)", () => {
                let firedEvent = false;
                const parser = createMessageParser();
                parser.once("part", (msg: IPart) => {
                    expect(msg.channel).to.equal("#ircconntest");
                    expect(msg.nick).to.equal("otherUser");
                    expect(msg.reason).to.equal("Some excuse");
                    firedEvent = true;
                });
                parser.actOnMessage(RPL_WELCOME_SRC);
                parser.actOnMessage(PART_CHANNEL_OTHER);
                expect(state.chans.has("#ircconntest")).to.be.false;
                expect(firedEvent).to.be.true;

            });
            it("handle other PART (w/ chan)", () => {
                let firedEvent = false;
                const parser = createMessageParser();
                state.chanData("#ircconntest", true) as IChannel;
                parser.once("part", (msg: IPart) => {
                    expect(msg.channel).to.equal("#ircconntest");
                    expect(msg.nick).to.equal("otherUser");
                    expect(msg.reason).to.equal("Some excuse");
                    firedEvent = true;
                });
                parser.actOnMessage(RPL_WELCOME_SRC);
                parser.actOnMessage(PART_CHANNEL_OTHER);
                expect(state.chans.has("#ircconntest")).to.be.true;
                expect(firedEvent).to.be.true;
            });
        });

        describe("kicks", () => {
            it("handle own KICK", () => {
                let firedEvent = false;
                const parser = createMessageParser();
                state.chanData("#ircconntest", true) as IChannel;
                parser.once("kick", (msg: IKick) => {
                    expect(msg.channel).to.equal("#ircconntest");
                    expect(msg.who).to.equal("Halfyyy");
                    expect(msg.reason).to.equal("Bad breath");
                    firedEvent = true;
                });
                parser.actOnMessage(RPL_WELCOME_SRC);
                parser.actOnMessage(KICK_CHANNEL);
                expect(state.chans.has("#ircconntest")).to.be.false;
                expect(firedEvent).to.be.true;
            });
            it("handle other KICK (no chan)", () => {
                let firedEvent = false;
                const parser = createMessageParser();
                parser.once("kick", (msg: IKick) => {
                    expect(msg.channel).to.equal("#ircconntest");
                    expect(msg.who).to.equal("otherUser");
                    expect(msg.reason).to.equal("Bad breath");
                    firedEvent = true;
                });
                parser.actOnMessage(RPL_WELCOME_SRC);
                parser.actOnMessage(KICK_CHANNEL_OTHER);
                expect(state.chans.has("#ircconntest")).to.be.false;
                expect(firedEvent).to.be.true;

            });
            it("handle other KICK (w/ chan)", () => {
                let firedEvent = false;
                const parser = createMessageParser();
                state.chanData("#ircconntest", true) as IChannel;
                parser.once("kick", (msg: IKick) => {
                    expect(msg.channel).to.equal("#ircconntest");
                    expect(msg.who).to.equal("otherUser");
                    expect(msg.reason).to.equal("Bad breath");
                    firedEvent = true;
                });
                parser.actOnMessage(RPL_WELCOME_SRC);
                parser.actOnMessage(KICK_CHANNEL_OTHER);
                expect(state.chans.has("#ircconntest")).to.be.true;
                expect(firedEvent).to.be.true;
            });
        });
        describe("privmsg", () => {
            it ("handles channels", (done) => {
                const parser = createMessageParser();
                parser.once("privmsg", (msg: INotice) => {
                    expect(msg.to).to.equal("#ircconntest");
                    expect(msg.text).to.equal("Hello!");
                    expect(msg.isCTCP).is.false;
                    done();
                });
                parser.actOnMessage(PRIVMSG);
            });
            it ("handles users", (done) => {
                const parser = createMessageParser();
                parser.once("privmsg", (msg: INotice) => {
                    expect(msg.from).to.equal("otherUser");
                    expect(msg.to).to.equal("Halfyyy");
                    expect(msg.text).to.equal("Hello!");
                    expect(msg.isCTCP).is.true;
                    done();
                });
                parser.actOnMessage(PRIVMSG_CTCP);
            });
        });
        it ("handles KILL", (done) => {
            const parser = createMessageParser();
            const c1 = state.chanData("#chan1", true) as IChannel;
            const c2 = state.chanData("#chan2", true) as IChannel;
            const c3 = state.chanData("#chan3", true) as IChannel;
            c1.users.Halfyyy = new Set();
            c2.users.Halfyyy = new Set();
            c3.users.Halfyyy = new Set();

            parser.once("kill", (msg: IQuit) => {
                expect(msg.channels).to.contain("#chan1");
                expect(msg.channels).to.contain("#chan2");
                expect(msg.channels).to.contain("#chan3");
                expect(c1.users).to.be.empty;
                expect(c2.users).to.be.empty;
                expect(c3.users).to.be.empty;
                expect(msg.reason).to.equal("Death by doggo!");
                done();
            });
            parser.actOnMessage(KILL);
        });

        it ("handles INVITE", (done) => {
            const parser = createMessageParser();
            parser.once("invite", (msg: IInvite) => {
                expect(msg.channel).to.equal("#ircconntest");
                expect(msg.to).to.equal("Halfyyy");
                done();
            });
            parser.actOnMessage(INVITE);
        });
        it ("handles QUIT", (done) => {
            const parser = createMessageParser();
            const c1 = state.chanData("#chan1", true) as IChannel;
            const c2 = state.chanData("#chan2", true) as IChannel;
            const c3 = state.chanData("#chan3", true) as IChannel;
            c1.users.Halfyyy = new Set();
            c2.users.Halfyyy = new Set();
            c3.users.Halfyyy = new Set();

            parser.once("quit", (msg: IQuit) => {
                expect(msg.channels).to.contain("#chan1");
                expect(msg.channels).to.contain("#chan2");
                expect(msg.channels).to.contain("#chan3");
                expect(c1.users).to.be.empty;
                expect(c2.users).to.be.empty;
                expect(c3.users).to.be.empty;
                expect(msg.reason).to.equal("Death by doggo!");
                done();
            });
            parser.actOnMessage(QUIT);
        });
        it ("handles CAP", (done) => {
            const parser = createMessageParser();
            parser.once("supports", (msg: ISupports) => {
                expect(msg.supports).to.contain("sasl");
                done();
            });
            parser.actOnMessage(RPL_SUPPORTS_SASL);
        });
        it("handle onErroneusNickname after welcome", () => {
            const parser = createMessageParser();
            parser.actOnMessage(RPL_WELCOME_SRC);
            expect(() => { parser.actOnMessage(ERRONEUS_NICK); }).to.throw;
        });
        it("handle onErroneusNickname", (done) => {
            const parser = createMessageParser();
            parser.once("nickname_unacceptable", (msg: IMessage) => {
                expect(msg).to.not.be.undefined;
                done();
            });
            parser.actOnMessage(ERRONEUS_NICK);
        });
    });
    describe("handleMessage", () => {
        it("will ignore useless info", () => {
            const parser = createMessageParser();
            USELESS_MSGS.forEach((msg: IMessage) => {
                expect(parser.actOnMessage(msg)).to.be.undefined;
            });
        });
        it("will emit on err_nicknameinuse", (done) => {
            const parser = createMessageParser();
            parser.once("nickname_in_use", done);
            parser.actOnMessage(parseMessage(":irc.example.com err_nicknameinuse"));
        });
        it("will emit on rpl_saslsuccess", (done) => {
            const parser = createMessageParser();
            parser.once("saslsuccess", done);
            parser.actOnMessage(parseMessage(":irc.example.com rpl_saslsuccess"));
        });
        it("will emit on PING", (done) => {
            const parser = createMessageParser();
            parser.once("ping", (msg: string) => {
                expect(msg).to.equal("LAG1537227775684");
                done();
            });
            parser.actOnMessage(parseMessage(":irc.example.com PING :LAG1537227775684"));
        });
        it("will emit on AUTHENTICATE", (done) => {
            const parser = createMessageParser();
            parser.once("auth", (msg: string) => {
                expect(msg).to.equal("+");
                done();
            });
            parser.actOnMessage(parseMessage(":irc.example.com AUTHENTICATE +"));
        });
        it("will set AWAY msg", () => {
            const parser = createMessageParser();
            state.whoisData.set("Halfyyy", {});
            parser.actOnMessage(parseMessage(":Halfyyy!someuser@irc.example.com AWAY :SomeAwayMessage"));
            expect(state.whoisData.get("Halfyyy").away).to.equal("SomeAwayMessage");
        });
        it("will set whois data", (done) => {
            const parser = createMessageParser();
            parser.once("whois", (msg: IMessage) => {
                done();
            });
            WHOIS_LIST.forEach((msg) => {
                parser.actOnMessage(msg);
            });
        });
        describe("motd", () => {
            it("will start, append and finish motd", () => {
                const parser = createMessageParser();
                MOTD_MESSAGES.forEach((msg) => {
                    parser.actOnMessage(msg);
                });
                expect(state.motd, "Halfy is a\nvery\nvery\ngood dog!");
            });
        });
    });
});
