/**
 * This code is heavily based upon https://github.com/matrix-org/node-irc
 * which is in turn based upon https://github.com/martynsmith/node-irc.
 *
 * The nessecity for this is the hugely complicated IRC "protocol" which
 * usually requires some amount of empirical testing rather than reading RFCs.
 * The existing librarys have good logic for parsing messages already and so it
 * has been reworked into this project. The major changes are typed variables,
 * and abstracting away the state from the client.
 *
 * The original file is https://github.com/matrix-org/node-irc/blob/master/lib/irc.js
 * Original copyright notice served below:
 *
 *   irc.js - Node JS IRC client library
 *
 *   (C) Copyright Martyn Smith 2010
 *
 *   This library is free software: you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation, either version 3 of the License, or
 *   (at your option) any later version.
 *   This library is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this library.  If not, see <http://www.gnu.org/licenses/>.
 */

import { IMessage } from "./IMessage";
import { IrcState, IChannelListItem } from "./IrcState";
import { Log } from "../Log";
import { EventEmitter } from "events";
import { IIrcSupported } from "./IrcSupported";
import { IrcUtil } from "./IrcUtil";
import { INotice } from "./Messages/INotice";
import { IMode } from "./Messages/IMode";
import { INick } from "./Messages/INick";
import { INames } from "./Messages/INames";
import { ITopic } from "./Messages/ITopic";
import { IJoin } from "./Messages/IJoin";
import { IPart } from "./Messages/IPart";
import { IKick } from "./Messages/IKick";
import { IQuit } from "./Messages/IQuit";
import { IInvite } from "./Messages/IInvite";
import { ISupports } from "./Messages/ISupports";
import { IError  } from "./Messages/IError";

/**
 * This class parses IRC messages and emits an event out where possible.
 * It also sets some state for the client to access, but does not have
 * direct access to the client itself.
 *
 * Event Name       | State updated | args
 * ----------       | ------------- | ----
 * registered       | nick hostMask maxLineLength | IMessage
 * channellist      | N/A | N/A
 * channellist_item | channelList | IChannelListItem
 * nickname_in_use  | N/A | N/A
 * nickname_unacceptable  | N/A | N/A
 * mode | channel/user modes updated | IMode
 * ping | N/A | ping string
 * pong | N/A | pong string
 * whois | N/A | IMessage
 * auth | N/A | plus string
 * saslsuccess | N/A | N/A
 * nick | nick | INick
 * names | N/A | INames
 * topic | channel.topic | ITopic
 * mode_is | channel.mode | IMode
 * join | channel.users | IJoin
 * part | channel.users | IPart
 * kick | channel.users | IKick
 * notice | N/A | INotice
 * privmsg | N/A | INotice
 * kill | N/A | IQuit
 * quit | N/A | IQuit
 * invite | N/A | IInvite
 * supports | N/A | ISupports
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
    public actOnMessage(msg: IMessage): boolean {
        return this.handleMessage(msg);
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
        this.state.hostMask = hostMask;
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
                            this.supported.channel.idlength[idChanSet[0]] = parseInt(idChanSet[1]);
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
        let text = msg.args[1] || "";
        if (text[0] === "\u0001" && text.lastIndexOf("\u0001") > 0) {
            text = text.substr(1, text.length - 2);
            isCTCP = true;
        }
        this.emit("notice", Object.assign(msg, {from, to, text, isCTCP}) as INotice);
    }

    private onMode(msg: IMessage) {
        IrcUtil.casemap(msg, 0, this.supported);
        this.log.verbose(`MODE: ${msg.args[0]} sets mode ${msg.args[1]}`);

        const channel = this.state.chanData(msg.args[0]);
        const modeList = msg.args[1].split("");
        let adding = true;
        const modeArgs = msg.args.slice(2);
        /**
         * We will still send the mode even if we don't know the channel, it might
         * be useful.
         */
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
                if (channel && channel.users[user]) {
                    adding ?  channel.users[user].add(this.supported.prefixForMode[mode]) :
                              channel.users[user].delete(this.supported.prefixForMode[mode]);
                }
                this.emit("mode", Object.assign(msg, {channel: msg.args[0], mode, affects: user, adding} as IMode));
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
            if (channel) {
                adding ? channel.mode.add(mode) : channel.mode.delete(mode);
            }
            this.emit("mode", Object.assign(msg, {channel: msg.args[0], mode, arg: modeArg, adding} as IMode));
        });
    }

    private onNick(msg: IMessage) {
        const newNick = msg.args[0];
        if (msg.nick === this.state.nick) {
            // the user just changed their own nick
            this.state.nick = newNick;
            this.state.updateMaxLineLength();
        }
        this.log.verbose(`Nick for ${msg.nick} changed to ${this.state.nick}`);

        const channels: string[] = [];

        // finding what channels a user is in
        this.state.chans.forEach((channel, channame) => {
            if (msg.nick !== undefined && msg.nick in channel.users) {
                channel.users[newNick] = channel.users[msg.nick];
                delete channel.users[msg.nick];
                channels.push(channame);
            }
        });

        this.emit("nick", Object.assign(msg, {newNick, channels}) as INick);
    }

    private onNames(msg: IMessage) {
        const IDX_CHANNEL = 2;
        const IDX_USERS = 3;
        IrcUtil.casemap(msg, IDX_CHANNEL, this.supported);
        const channel = this.state.chanData(msg.args[IDX_CHANNEL]);
        if (!channel) {
            return;
        }
        if (!msg.args[IDX_USERS]) {
            // No users
            return;
        }
        const users = msg.args[IDX_USERS].trim().split(/ +/);
        users.forEach((user) => {
            // user = "@foo", "+foo", "&@foo", etc...
            // The symbols are the prefix set.
            const allowedSymbols = Object.keys(this.supported.modeForPrefix).join("");
            // Split out the prefix from the nick e.g "@&foo" => ["@&foo", "@&", "foo"]
            const prefixRegex = new RegExp("^([" + escapeRegExp(allowedSymbols) + "]*)(.*)$");
            const match = user.match(prefixRegex);
            if (match) {
                const userPrefixes = match[1];
                let knownPrefixes = "";
                for (const prefix of userPrefixes) {
                    if (prefix in this.supported.modeForPrefix) {
                        knownPrefixes += prefix;
                    }
                }
                if (knownPrefixes.length > 0) {
                    channel.users[match[2]] = new Set(knownPrefixes);
                } else {
                    // recombine just in case this server allows weird chars in the nick.
                    // We know it isn't a mode char.
                    channel.users[match[1] + match[2]] = new Set();
                }
            }
        });
    }

    private onTopicReply(msg: IMessage) {
        IrcUtil.casemap(msg, 1, this.supported);
        const channel = this.state.chanData(msg.args[1]);
        if (channel) {
            channel.topic = msg.args[2];
        }
    }

    private onEndOfNames(msg: IMessage) {
        IrcUtil.casemap(msg, 1, this.supported);
        const channel = this.state.chanData(msg.args[1]);
        if (channel) {
            this.emit("names", Object.assign(msg, {users: channel.users, channel: msg.args[1]}) as INames);
        }
    }

    private onTopicWhoTime(msg: IMessage) {
        IrcUtil.casemap(msg, 1, this.supported);
        const channel = this.state.chanData(msg.args[1]);
        if (channel) {
            channel.topicBy = msg.args[2];
            // channel, topic, nick
            this.emit("topic", Object.assign(msg, {
                channel: msg.args[1],
                topic: channel.topic,
                topicBy: channel.topicBy,
            }) as ITopic);
        }
    }

    private onTopic(msg: IMessage) {
        // channel, topic, nick
        IrcUtil.casemap(msg, 0, this.supported);
        const channel = this.state.chanData(msg.args[0]);
        if (channel) {
            channel.topic = msg.args[1];
            channel.topicBy = msg.nick;
        }
        this.emit("topic", Object.assign(msg, {
            channel: msg.args[0],
            topic: msg.args[1],
            topicBy: msg.nick,
        }) as ITopic);
    }

    private onChannelModeIs(msg: IMessage) {
        IrcUtil.casemap(msg, 1, this.supported);
        const channel = this.state.chanData(msg.args[1]);
        if (channel) {
            channel.mode = new Set(msg.args[2]);
        }

        this.emit("mode_is", Object.assign(msg, { mode: msg.args[2], channel: msg.args[1] }) as IMode);
    }

    private onJoin(msg: IMessage) {
        IrcUtil.casemap(msg, 0, this.supported);
        const self = Boolean(msg.nick && this.state.nick === msg.nick);
        const channel = this.state.chanData(msg.args[0], self);
        const arg: IJoin = Object.assign(msg, {channel: msg.args[0]});
        if (msg.nick && channel) {
            channel.users[msg.nick] = new Set();
            this.emit(`join${channel.key}`, arg);

        }
        this.emit("join", arg);
    }

    private onPart(msg: IMessage) {
        IrcUtil.casemap(msg, 0, this.supported);
        // channel, who, reason
        this.emit("part", Object.assign(msg, {channel: msg.args[0], reason: msg.args[1]}) as IPart);
        const channel = this.state.chanData(msg.args[0]);
        if (!channel || !msg.nick) {
            return;
        }
        if (this.state.nick === msg.nick) {
            this.state.chans.delete(channel.key);
            return;
        }
        delete channel.users[msg.nick];
    }

    private onKick(msg: IMessage) {
        IrcUtil.casemap(msg, 0, this.supported);
        // channel, who, by, reason
        const who = msg.args[1];
        this.emit("kick", Object.assign(msg, {channel: msg.args[0], who, reason: msg.args[2]} as IKick));
        const channel = this.state.chanData(msg.args[0]);
        if (!channel || !msg.nick) {
            return;
        }

        if (this.state.nick === who) {
            this.state.chans.delete(channel.key);
            return;
        }
        delete channel.users[who];
    }

    private onPrivMsg(msg: IMessage) {
        IrcUtil.casemap(msg, 0, this.supported);
        const from = msg.nick;
        const to = msg.args[0];
        let text = msg.args[1] || "";
        const isCTCP = (text[0] === "\u0001" && text.lastIndexOf("\u0001") > 0);
        if (isCTCP) {
            text = text.substr(1, text.length - 2);
        }
        this.emit("privmsg", {from, to, text, isCTCP} as INotice);
    }

    private onKill(msg: IMessage) {
        const nick = msg.args[0];
        const channels: string[] = [];
        this.state.chans.forEach((channel, channame) => {
            if (channel.users[nick]) {
                channels.push(channame);
                delete channel.users[nick];
            }
        });

        this.emit("kill", Object.assign(msg, {channels, reason: msg.args[1]} as IQuit));
    }

    private onInvite(msg: IMessage) {
        IrcUtil.casemap(msg, 1, this.supported);
        this.emit("invite", Object.assign(msg, {to: msg.args[0], channel: msg.args[1]} as IInvite));
    }

    private onQuit(msg: IMessage) {
        if (this.state.nick === msg.nick) {
            // We are quitting? Well let's ignore it since we'll fire a disconnect event somewhere..
            return;
        }
        // handle other people quitting

        const channels: string[] = [];

        // finding what channels a user is in?
        this.state.chans.forEach( (channel, channame) => {
            if (msg.nick && msg.nick in channel.users) {
                delete channel.users[msg.nick];
                channels.push(channame);
            }
        });

        // reason, channels
        this.emit("quit", Object.assign(msg, {reason: msg.args[0], channels} as IQuit));
    }

    private onCap(msg: IMessage) {
        if (msg.args[0] === "*" &&
        msg.args[1] === "ACK") {
            const supports = msg.args[2].trim(); // there"s a space after sasl
            this.emit("supports", {supports} as ISupports);
        }
    }

    private onErroneusNickname(msg: IMessage) {
        this.log.warn("Nickname flagged as erroneous");

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
        // Check to see if we are NOT logged in.
        if (this.state.hostMask !== "") { // hostMask set on rpl_welcome
            // Just emit an error, and the client will probably ignore
            throw new Error("Nick was flagged as erroneous");
        }
        // rpl_welcome has not been sent
        // Ask for a new nick.
        this.emit("nickname_unacceptable", msg);
    }

    private handleMessage(msg: IMessage): boolean {
        // indexes
        const MYINFO_USERMODES = 3;
        const AWAY = 0;
        const WHOIS_AWAY = 2;
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
               this.onNick(msg);
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
           case "AWAY":
                if (msg.nick === undefined) {
                    break;
                }
                this.state.setWhoisData(msg.nick, "away", msg.args[AWAY], true);
                break;
           // Can't find this being used anywhere.
           case "rpl_away":
                this.state.setWhoisData(msg.args[1], "away", msg.args[WHOIS_AWAY], true);
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
                   return false;
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
               this.emit("auth", msg.args[0]);
               break;
           case "rpl_saslsuccess":
               this.emit("saslsuccess");
               break;
           case "err_unavailresource":
           // err_unavailresource has been seen in the wild on Freenode when trying to
           // connect with the nick "boot". I"m guessing they have reserved that nick so
           // no one can claim it. The error handling though is identical to offensive word
           // nicks hence the fall through here.
           case "err_erroneusnickname":
               this.onErroneusNickname(msg);
               break;
           /* These errors are usually a consequence of a user action and should be treated
              a bit differently. We emit a special error object with a key so the promise
              can be reject sensibly.*/
           case "err_nosuchnick":
           case "err_nosuchserver":
           case "err_nosuchchannel":
           case "err_nonicknamegiven":
           case "err_norecipient":
           case "err_toomanychannels":
           case "err_cannotsendtochan":
           case "err_usernotinchannel":
               const target = msg.args[1];
               this.emit(`action_error`, {
                   target,
                   error: msg.args[2],
               } as IError);

               this.emit(`action_error:${target}`, {
                   target,
                   error: msg.args[2],
               } as IError);
               break;
           default:
               if (msg.commandType === "error") {
                   this.log.warn(`Error on ${msg.command} ${msg.rawCommand}`);
                   this.emit("error", msg);
               }
               this.log.verbose(`Unhandled ${msg.command} ${msg.rawCommand}`);
               return false;
       }
        return true;
    }
}

// https://developer.mozilla.org/en/docs/Web/JavaScript/Guide/Regular_Expressions
function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
