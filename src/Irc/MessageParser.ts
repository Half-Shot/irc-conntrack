import { IMessage } from "./IMessage";
import { IrcClient } from "./IrcClient";
import { IrcState, IChannelListItem } from "./IrcState";
import { Log } from "../Log";
import { EventEmitter } from "events";
import { IIrcSupported } from "./IrcSupported";
import { IrcUtil } from "./IrcUtil";
import { INotice } from "./Messages/INotice";
import { IMode } from "./Messages/IMode";

/**
 * This class parses IRC messages and emits an event out where possible.
 * It also sets some state for the client to access, but does not have
 * direct access to the client itself.
 *
 * Event Name       | State updated | args
 * ----------       | ------------- | ----
 * registered       | nick hostMask maxLineLength | IMessage
 * channellist_item | channelList | IChannelListItem
 * nickname_in_use  | N/A | N/A
 * notice           | N/A | INotice
 * mode | N/A | IMode
 * ping | N/A | pingstring
 */

export class MessageParser extends EventEmitter {
    private log: Log;

    constructor(
        uuid: string,
        private state: IrcState,
        private supported: IIrcSupported,
    ) {
        super();
        this.log = new Log(`MsgParser#${uuid}`);
    }

    /**
     * This function will take an incoming msg and apply it to the state.
     * It may also emit an event. State updated by the message is listed
     * in a table, in MessageParser.ts.
     *
     * This will throw on an error rather than emitting one, and the calling
     * function should decide whether to terminate the connection based on the error.
     */
    public actOnMessage(msg: IMessage) {
        this.handleMessage(msg);
    }

    private onWelcome(msg: IMessage) {
        // Set nick to whatever the server decided it really is
        // (normally this is because you chose something too long and
        // the server has shortened it
        this.state.nick = msg.args[0];
        // Note our hostmask to use it in splitting long messages.
        // We don"t send our hostmask when issuing PRIVMSGs or NOTICEs,
        // of course, but rather the servers on the other side will
        // include it in messages and will truncate what we send if
        // the string is too long. Therefore, we need to be considerate
        // neighbors and truncate our messages accordingly.
        const welcomeStringWords = msg.args[1].split(/\s+/);
        const hostMask = welcomeStringWords[welcomeStringWords.length - 1];
        this.state.updateMaxLineLength();
        this.emit("registered", msg);
    }

    private onISupport(msg: IMessage) {
        let match: RegExpMatchArray | null;
        msg.args.forEach((arg) => {
            match = arg.match(/([A-Z]+)=(.*)/);
            if (match) {
                const param = match[1];
                const value = match[2];
                switch (param) {
                    case "CASEMAPPING":
                        this.supported.casemapping = value;
                        break;
                    case "CHANLIMIT":
                        value.split(",").forEach((prefixVal) => {
                            const prefixValSet = prefixVal.split(":");
                            this.supported.channel.limit[prefixValSet[0]] = parseInt(prefixValSet[1]);
                        });
                        break;
                    case "CHANMODES":
                        const modeSet = value.split(",");
                        const modes = ["a", "b", "c", "d"];
                        for (let i = 0; i < modes.length; i++) {
                            this.supported.channel.modes[modes[i]] += modeSet[i];
                        }
                        break;
                    case "CHANTYPES":
                        this.supported.channel.types = value;
                        break;
                    case "CHANNELLEN":
                        this.supported.channel.length = parseInt(value);
                        break;
                    case "IDCHAN":
                        value.split(",").forEach((val) => {
                            const idChanSet = val.split(":");
                            this.supported.channel.idlength[idChanSet[0]] = idChanSet[1];
                        });
                        break;
                    case "KICKLEN":
                        this.supported.kicklength = parseInt(value);
                        break;
                    case "MAXLIST":
                        value.split(",").forEach((val) => {
                            const listSplit = val.split(":");
                            this.supported.maxlist[listSplit[0]] = parseInt(listSplit[1]);
                        });
                        break;
                    case "NICKLEN":
                        this.supported.nicklength = parseInt(value);
                        break;
                    case "PREFIX":
                        // https://tools.ietf.org/html/draft-hardy-irc-isupport-00#section-4.15
                        match = value.match(/\((.*?)\)(.*)/);
                        if (match) {
                            this.supported.usermodepriority = match[1];
                            const prefixModes = match[1].split("");
                            const prefixes = match[2].split("");
                            while (prefixModes.length) {
                                this.supported.modeForPrefix[prefixes[0]] = prefixModes[0];
                                this.supported.channel.modes.b += prefixModes[0];
                                this.supported.prefixForMode[prefixModes.shift() as string] =
                                    prefixes.shift() as string;
                            }
                        }
                        break;
                    case "STATUSMSG":
                        break;
                    case "TARGMAX":
                        value.split(",").forEach((val) => {
                            const targMax = val.split(":");
                            const target = (!targMax[1]) ? 0 : parseInt(targMax[1]);
                            this.supported.maxtargets[targMax[0]] = target;
                        });
                        break;
                    case "TOPICLEN":
                        this.supported.topiclength = parseInt(value);
                        break;
                }
            }
        });
    }

    private onNotice(msg: IMessage) {
        IrcUtil.casemap(msg, 0, this.supported);
        const from = msg.nick;
        let isCTCP = false;
        let to: string|null = msg.args[0];
        if (!to) {
            to = null;
        }
        const text = msg.args[1] || "";
        if (text[0] === "\u0001" && text.lastIndexOf("\u0001") > 0) {
            isCTCP = true;
        }
        this.emit("notice", Object.assign(msg, {from, to, text, isCTCP}) as INotice);
    }

    private onMode(msg: IMessage) {
        IrcUtil.casemap(msg, 0, this.supported);
        this.log.verbose(`MODE: ${msg.args[0]} sets mode ${msg.args[1]}`);

        const channel = this.state.chanData(msg.args[0]);
        if (!channel)  {
            return;
        }
        const modeList = msg.args[1].split("");
        let adding = true;
        const modeArgs = msg.args.slice(2);
        modeList.forEach((mode) => {
            if (mode === "+") {
                adding = true;
                return;
            }
            if (mode === "-") {
                adding = false;
                return;
            }
            if (mode in this.supported.prefixForMode) {
                // channel user modes
                const user = modeArgs.shift();
                if (!user) {
                    return;
                }
                if (adding) {
                    if (channel.users[user]) {
                        channel.users[user].add(this.supported.prefixForMode[mode]);
                    }
                    return;
                }
                if (channel.users[user]) {
                    channel.users[user].delete(this.supported.prefixForMode[mode]);
                }
                this.emit("mode", Object.assign(msg, {channel: msg.args[0], mode, user, adding} as IMode));
                return;
            }
            let modeArg;
            // channel modes
            if (mode.match(/^[bkl]$/)) {
                modeArg = modeArgs.shift();
                if (!modeArg || modeArg.length === 0) {
                    modeArg = undefined;
                }
            }
            // TODO - deal nicely with channel modes that take args
            adding ? channel.mode.add(mode) : channel.mode.delete(mode);
            this.emit("mode", Object.assign(msg, {channel: msg.args[0], mode, arg: modeArg, adding} as IMode));
        });
    }

    private onNick(msg: IMessage) {
        if (message.nick == self.nick) {
            // the user just changed their own nick
            self.nick = msg.args[0];
            this.state.updateMaxLineLength();
        }

        if (self.opt.debug)
            util.log("NICK: " + message.nick + " changes nick to " + msg.args[0]);

        channels = [];

        // finding what channels a user is in
        Object.keys(self.chans).forEach(function(channame) {
            var channel = self.chans[channame];
            if (message.nick in channel.users) {
                channel.users[msg.args[0]] = channel.users[message.nick];
                delete channel.users[message.nick];
                channels.push(channame);
            }
        });

        // old nick, new nick, channels
        self.emit("nick", message.nick, msg.args[0], channels, message);
    }

    private onNames(msg: IMessage) {
        IrcUtil.casemap(msg, 2);
        channel = this.state.chanData(msg.args[2]);
        if (!msg.args[3]) {
            // No users
            break;
        }
        var users = msg.args[3].trim().split(/ +/);
        if (channel) {
            users.forEach(function(user) {
                // user = "@foo", "+foo", "&@foo", etc...
                // The symbols are the prefix set.
                var allowedSymbols = Object.keys(self.modeForPrefix).join("");
                // Split out the prefix from the nick e.g "@&foo" => ["@&foo", "@&", "foo"]
                var prefixRegex = new RegExp("^([" + escapeRegExp(allowedSymbols) + "]*)(.*)$");
                var match = user.match(prefixRegex);
                if (match) {
                    var userPrefixes = match[1];
                    var knownPrefixes = "";
                    for (var i = 0; i < userPrefixes.length; i++) {
                        if (userPrefixes[i] in self.modeForPrefix) {
                            knownPrefixes += userPrefixes[i];
                        }
                    }
                    if (knownPrefixes.length > 0) {
                        channel.users[match[2]] = knownPrefixes;
                    }
                    else {
                        // recombine just in case this server allows weird chars in the nick.
                        // We know it isn"t a mode char.
                        channel.users[match[1] + match[2]] = "";
                    }
                }
            });
        }
    }

    private onTopicReply(msg: IMessage) {
        IrcUtil.casemap(msg, 1);
        channel = this.state.chanData(msg.args[1]);
        if (channel) {
            channel.topic = msg.args[2];
        }
    }

    private onEndOfNames(msg: IMessage) {
        IrcUtil.casemap(msg, 1);
        channel = this.state.chanData(msg.args[1]);
        if (channel) {
            self.emit("names", msg.args[1], channel.users);
            self.emit("names" + msg.args[1], channel.users);
            self.send("MODE", msg.args[1]);
        }
    }

    private onTopicWhoTime(msg: IMessage) {
        IrcUtil.casemap(msg, 1);
        channel = this.state.chanData(msg.args[1]);
        if (channel) {
            channel.topicBy = msg.args[2];
            // channel, topic, nick
            self.emit("topic", msg.args[1], channel.topic, channel.topicBy, message);
        }
    }

    private onTopic(msg: IMessage) {
        // channel, topic, nick
        IrcUtil.casemap(msg, 0, this.supported);
        self.emit("topic", msg.args[0], msg.args[1], message.nick, message);

        channel = this.state.chanData(msg.args[0]);
        if (channel) {
            channel.topic = msg.args[1];
            channel.topicBy = message.nick;
        }
    }

    private onChannelModeIs(msg: IMessage) {
        IrcUtil.casemap(msg, 1);
        channel = this.state.chanData(msg.args[1]);
        if (channel) {
            channel.mode = msg.args[2];
        }

        self.emit("mode_is", msg.args[1], msg.args[2]);
    }

    private onJoin(msg: IMessage) {
        IrcUtil.casemap(msg, 0, this.supported);
        // channel, who
        if (self.nick == message.nick) {
            this.state.chanData(msg.args[0], true);
        }
        else {
            channel = this.state.chanData(msg.args[0]);
            if (channel && channel.users) {
                channel.users[message.nick] = "";
            }
        }
        self.emit("join", msg.args[0], message.nick, message);
        self.emit("join" + msg.args[0], message.nick, message);
        if (msg.args[0] != msg.args[0].toLowerCase()) {
            self.emit("join" + msg.args[0].toLowerCase(), message.nick, message);
        }
    }

    private onPart(msg: IMessage) {
        IrcUtil.casemap(msg, 0, this.supported);
        // channel, who, reason
        self.emit("part", msg.args[0], message.nick, msg.args[1], message);
        self.emit("part" + msg.args[0], message.nick, msg.args[1], message);
        if (msg.args[0] != msg.args[0].toLowerCase()) {
            self.emit("part" + msg.args[0].toLowerCase(), message.nick, msg.args[1], message);
        }
        if (self.nick == message.nick) {
            channel = this.state.chanData(msg.args[0]);
            delete self.chans[channel.key];
        }
        else {
            channel = this.state.chanData(msg.args[0]);
            if (channel && channel.users) {
                delete channel.users[message.nick];
            }
        }
    }

    private onKick(msg: IMessage) {
        IrcUtil.casemap(msg, 0, this.supported);
        // channel, who, by, reason
        self.emit("kick", msg.args[0], msg.args[1], message.nick, msg.args[2], message);
        self.emit("kick" + msg.args[0], msg.args[1], message.nick, msg.args[2], message);
        if (msg.args[0] != msg.args[0].toLowerCase()) {
            self.emit("kick" + msg.args[0].toLowerCase(),
                      msg.args[1], message.nick, msg.args[2], message);
        }

        if (self.nick == msg.args[1]) {
            channel = this.state.chanData(msg.args[0]);
            delete self.chans[channel.key];
        }
        else {
            channel = this.state.chanData(msg.args[0]);
            if (channel && channel.users) {
                delete channel.users[msg.args[1]];
            }
        }
    }

    private onPrivMsg(msg: IMessage) {
        IrcUtil.casemap(msg, 0, this.supported);
        from = message.nick;
        to = msg.args[0];
        text = msg.args[1] || "";
        if (text[0] === "\u0001" && text.lastIndexOf("\u0001") > 0) {
            self._handleCTCP(from, to, text, "privmsg", message);
            break;
        }
        self.emit("message", from, to, text, message);
        if (self.supported.channel.types.indexOf(to.charAt(0)) !== -1) {
            self.emit("message#", from, to, text, message);
            self.emit("message" + to, from, text, message);
            if (to != to.toLowerCase()) {
                self.emit("message" + to.toLowerCase(), from, text, message);
            }
        }
        if (to.toUpperCase() === self.nick.toUpperCase()) self.emit("pm", from, text, message);

        if (self.opt.debug && to == self.nick)
            util.log("GOT MESSAGE from " + from + ": " + text);
    }

    private onKill(msg: IMessage) {
        nick = msg.args[0];
        channels = [];
        Object.keys(self.chans).forEach(function(channame) {
            var channel = self.chans[channame];
            if (nick in channel.users) {
                channels.push(channame);
                delete channel.users[nick];
            }
        });
        self.emit("kill", nick, msg.args[1], channels, message);
    }

    private onKill(msg: IMessage) {
        if (self.opt.debug)
                   util.log("QUIT: " + message.prefix + " " + msg.args.join(" "));
        if (self.nick == message.nick) {
                   // TODO handle?
                   break;
               }
               // handle other people quitting

        channels = [];

               // finding what channels a user is in?
        Object.keys(self.chans).forEach(function(channame) {
                   var channel = self.chans[channame];
                   if (message.nick in channel.users) {
                       delete channel.users[message.nick];
                       channels.push(channame);
                   }
               });

               // who, reason, channels
        self.emit("quit", message.nick, msg.args[0], channels, message);
    }

    private onInvite(msg: IMessage) {
        IrcUtil.casemap(msg, 1);
        from = message.nick;
        to = msg.args[0];
        channel = msg.args[1];
        self.emit("invite", channel, from, message);
    }

    private onCap(msg: IMessage) {
        if (msg.args[0] === "*" &&
        msg.args[1] === "ACK" &&
        msg.args[2] === "sasl ") { // there"s a space after sasl
        self.send("AUTHENTICATE", "PLAIN");
        }
    }

    private onAuthenticate(msg: IMessage) {
        if (msg.args[0] === "+") { self.send("AUTHENTICATE",
        new Buffer(
            self.opt.nick + "\0" +
            self.opt.userName + "\0" +
            self.opt.password
        ).toString("base64"));
        }
    }

    private onErroneusNickname(msg: IMessage) {
        if (self.opt.showErrors) {
            util.log("\033[01;31mERROR: " + util.inspect(message) + "\033[0m");
        }
        // The Scunthorpe Problem
        // ----------------------
        // Some IRC servers have offensive word filters on nicks. Trying to change your
        // nick to something with an offensive word in it will return this error.
        //
        // If we are already logged in, this is fine, we can just emit an error and
        // let the client deal with it.
        // If we are NOT logged in however, we need to propose a new nick else we
        // will never be able to connect successfully and the connection will
        // eventually time out, most likely resulting in infinite-reconnects.
        //
        // Check to see if we are NOT logged in, and if so, use a "random" string
        // as the next nick.
        if (self.hostMask !== "") { // hostMask set on rpl_welcome
            throw new Error(message);
            break;
        }
        // rpl_welcome has not been sent
        // We can"t use a truly random string because we still need to abide by
        // the BNF for nicks (first char must be A-Z, length limits, etc). We also
        // want to be able to debug any issues if people say that they didn"t get
        // the nick they wanted.
        let rndNick = "enick_" + Math.floor(Math.random() * 1000) // random 3 digits
        self.send("NICK", rndNick);
        self.nick = rndNick;
        this.state.updateMaxLineLength();
    }

    private handleMessage(msg: IMessage) {
        // indexes
        const MYINFO_USERMODES = 3;
        const AWAY = 2;
        const WHOIS_USER = 2;
        const WHOIS_HOST = 3;
        const WHOIS_REALNAME = 5;
        const WHOIS_IDLE = 2;
        switch (msg.command) {
           case "rpl_welcome":
               this.onWelcome(msg);
               break;
           case "rpl_myinfo":
               this.supported.usermodes = msg.args[MYINFO_USERMODES];
               break;
           case "rpl_isupport":
              this.onISupport(msg);
              break;
           case "rpl_yourhost":
           case "rpl_created":
           case "rpl_luserclient":
           case "rpl_luserop":
           case "rpl_luserchannels":
           case "rpl_luserme":
           case "rpl_localusers":
           case "rpl_globalusers":
           case "rpl_statsconn":
           case "rpl_luserunknown":
               // Random welcome crap, ignoring
               break;
           case "err_nicknameinuse":
               this.emit("nickname_in_use");
               break;
           case "PING":
               this.emit("ping", msg.args[0]);
               break;
           case "PONG":
               this.emit("pong", msg.args[0]);
               break;
           case "NOTICE":
               this.onNotice(msg);
               break;
           case "MODE":
               this.onMode(msg);
               break;
           case "NICK":
               break;
           case "rpl_motdstart":
               this.state.appendMotd(msg.args[1] + "\n", true);
               break;
           case "rpl_motd":
               this.state.appendMotd(msg.args[1] + "\n");
               break;
           case "rpl_endofmotd":
           case "err_nomotd":
               this.state.appendMotd(msg.args[1] + "\n", false);
               break;
           case "rpl_namreply":
               this.onNames(msg);
               break;
           case "rpl_endofnames":
               this.onEndOfNames(msg);
               break;
           case "rpl_topic":
               this.onTopicReply(msg);
               break;
           case "rpl_away":
               this.state.setWhoisData(msg.args[1], "away", msg.args[AWAY], true);
               break;
           case "rpl_whoisuser":
               this.state.setWhoisData(msg.args[1], "user", msg.args[2]);
               this.state.setWhoisData(msg.args[1], "host", msg.args[WHOIS_HOST]);
               this.state.setWhoisData(msg.args[1], "realname", msg.args[WHOIS_REALNAME]);
               break;
           case "rpl_whoisidle":
               this.state.setWhoisData(msg.args[1], "idle", msg.args[WHOIS_IDLE]);
               break;
           case "rpl_whoischannels":
              // TODO - clean this up?
               if (msg.args.length <= 2) {
                   return;
               }
               this.state.setWhoisData(msg.args[1], "channels", msg.args[2].trim().split(/\s+/));
               break;
           case "rpl_whoisserver":
               const WHOIS_SERVER = 2;
               const WHOIS_SERVERINFO = 3;
               this.state.setWhoisData(msg.args[1], "server", msg.args[WHOIS_SERVER]);
               this.state.setWhoisData(msg.args[1], "serverinfo", msg.args[WHOIS_SERVERINFO]);
               break;
           case "rpl_whoisoperator":
               this.state.setWhoisData(msg.args[1], "operator", msg.args[2]);
               break;
           case "330": // rpl_whoisaccount?
               const WHOIS_ACCOUNT = 2;
               const WHOIS_ACCOUNTINFO = 3;
               this.state.setWhoisData(msg.args[1], "account", msg.args[WHOIS_ACCOUNT]);
               this.state.setWhoisData(msg.args[1], "accountinfo", msg.args[WHOIS_ACCOUNTINFO]);
               break;
           case "rpl_endofwhois":
               this.emit("whois", msg);
               break;
           case "rpl_liststart":
               this.state.channelList = [];
               break;
           case "rpl_list":
               const LIST_CHANNEL = 1;
               const LIST_USERS = 2;
               const LIST_TOPIC = 3;
               const chan: IChannelListItem = {
                    name: msg.args[LIST_CHANNEL],
                    users: msg.args[LIST_USERS],
                    topic: msg.args[LIST_TOPIC],
               };
               this.state.channelList.push(chan);
               this.emit("channellist_item", chan);
               break;
           case "rpl_listend":
               this.emit("channellist");
               break;
           case "rpl_topicwhotime":
               this.onTopicWhoTime(msg);
               break;
           case "TOPIC":
               this.onTopic(msg);
               break;
           case "rpl_channelmodeis":
               this.onChannelModeIs(msg);
               break;
           case "rpl_creationtime":
               IrcUtil.casemap(msg, 1, this.supported);
               const channel = this.state.chanData(msg.args[1]);
               if (channel) {
                   channel.created = msg.args[2];
               }
               break;
           case "JOIN":
               this.onJoin(msg);
               break;
           case "PART":
               this.onPart(msg);
               break;
           case "KICK":
               this.onKick(msg);
               break;
           case "KILL":
               this.onKill(msg);
               break;
           case "PRIVMSG":
               this.onPrivMsg(msg);
               break;
           case "INVITE":
               this.onInvite(msg);
               break;
           case "QUIT":
               this.onQuit(msg);
               break;
           // for sasl
           case "CAP":
               this.onCap(msg);
               break;
           case "AUTHENTICATE":
               this.onAuthenticate(msg);
               break;
           case "rpl_saslsuccess":
               self.send("CAP", "END");
               break;
           case "err_unavailresource":
           // err_unavailresource has been seen in the wild on Freenode when trying to
           // connect with the nick "boot". I"m guessing they have reserved that nick so
           // no one can claim it. The error handling though is identical to offensive word
           // nicks hence the fall through here.
           case "err_erroneusnickname":
               this.onErroneusNickname(msg);
               break;
           default:
               if (msg.commandType === "error") {
                   this.log.warn(`Error on ${msg.command} ${msg.rawCommand}`);
                   throw new Error("Error on message: ${msg.command} ${msg.rawCommand}");
               }
               this.log.verbose(`Unhandled ${msg.command} ${msg.rawCommand}`);
               break;
       }
    }
}
