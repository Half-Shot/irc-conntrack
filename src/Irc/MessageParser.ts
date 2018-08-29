import { IMessage } from "./IMessage";
import { IrcClient } from "./IrcClient";
import { Log } from "../Log";

export class MessageParser {
    private log: Log;

    constructor(private client: IrcClient) {
        this.log = new Log("MsgParser#"+client.uuid);
    }

    private onWelcome(msg: IMessage) {
        // Set nick to whatever the server decided it really is
        // (normally this is because you chose something too long and
        // the server has shortened it
        this.client.setGivenNick(msg.args[0]);
        // Note our hostmask to use it in splitting long messages.
        // We don't send our hostmask when issuing PRIVMSGs or NOTICEs,
        // of course, but rather the servers on the other side will
        // include it in messages and will truncate what we send if
        // the string is too long. Therefore, we need to be considerate
        // neighbors and truncate our messages accordingly.
        var welcomeStringWords = msg.args[1].split(/\s+/);
        self.hostMask = welcomeStringWords[welcomeStringWords.length - 1];
        self._updateMaxLineLength();
        self.emit('registered', message);
        self.whois(self.nick, function(args) {
            self.nick = args.nick;
            self.hostMask = args.user + "@" + args.host;
            self._updateMaxLineLength();
        });
    }

    private onISupport(msg: IMessage) {
        (msg.args as string[]).forEach((arg) => {
            var match;
            match = arg.match(/([A-Z]+)=(.*)/);
            if (match) {
                var param = match[1];
                var value = match[2];
                switch (param) {
                    case 'CASEMAPPING':
                        self.supported.casemapping = value;
                        break;
                    case 'CHANLIMIT':
                        value.split(',').forEach(function(val) {
                            val = val.split(':');
                            self.supported.channel.limit[val[0]] = parseInt(val[1]);
                        });
                        break;
                    case 'CHANMODES':
                        value = value.split(',');
                        var type = ['a', 'b', 'c', 'd'];
                        for (var i = 0; i < type.length; i++) {
                            self.supported.channel.modes[type[i]] += value[i];
                        }
                        break;
                    case 'CHANTYPES':
                        self.supported.channel.types = value;
                        break;
                    case 'CHANNELLEN':
                        self.supported.channel.length = parseInt(value);
                        break;
                    case 'IDCHAN':
                        value.split(',').forEach(function(val) {
                            val = val.split(':');
                            self.supported.channel.idlength[val[0]] = val[1];
                        });
                        break;
                    case 'KICKLEN':
                        self.supported.kicklength = value;
                        break;
                    case 'MAXLIST':
                        value.split(',').forEach(function(val) {
                            val = val.split(':');
                            self.supported.maxlist[val[0]] = parseInt(val[1]);
                        });
                        break;
                    case 'NICKLEN':
                        self.supported.nicklength = parseInt(value);
                        break;
                    case 'PREFIX':
                        match = value.match(/\((.*?)\)(.*)/);
                        if (match) {
                            self.supported.usermodepriority = match[1];
                            match[1] = match[1].split('');
                            match[2] = match[2].split('');
                            while (match[1].length) {
                                self.modeForPrefix[match[2][0]] = match[1][0];
                                self.supported.channel.modes.b += match[1][0];
                                self.prefixForMode[match[1].shift()] = match[2].shift();
                            }
                        }
                        break;
                    case 'STATUSMSG':
                        break;
                    case 'TARGMAX':
                        value.split(',').forEach(function(val) {
                            val = val.split(':');
                            val[1] = (!val[1]) ? 0 : parseInt(val[1]);
                            self.supported.maxtargets[val[0]] = val[1];
                        });
                        break;
                    case 'TOPICLEN':
                        self.supported.topiclength = parseInt(value);
                        break;
                }
            }
        });
    }

    private onNicknameInUse(msg: IMessage) {
        var nextNick = self.opt.onNickConflict();
        if (self.opt.nickMod > 1) {
            // We've already tried to resolve this nick before and have failed to do so.
            // This could just be because there are genuinely 2 clients with the
            // same nick and the same nick with a numeric suffix or it could be much
            // much more gnarly. If there is a conflict and the original nick is equal
            // to the NICKLEN, then we'll never be able to connect because the numeric
            // suffix will always be truncated!
            //
            // To work around this, we'll persist what nick we send up, and compare it
            // to the nick which is returned in this error response. If there is
            // truncation going on, the two nicks won't match, and then we can do
            // something about it.

            if (prevClashNick !== '') {
                // we tried to fix things and it still failed, check to make sure
                // that the server isn't truncating our nick.
                var errNick = message.args[1];
                if (errNick !== prevClashNick) {
                    nextNick = self.opt.onNickConflict(errNick.length);
                }
            }

            prevClashNick = nextNick;
        }

        self.send('NICK', nextNick);
        self.nick = nextNick;
        self._updateMaxLineLength();
    }

    private onNotice(msg: IMessage) {
        self._casemap(message, 0);
        from = message.nick;
        to = message.args[0];
        if (!to) {
            to = null;
        }
        text = message.args[1] || '';
        if (text[0] === '\u0001' && text.lastIndexOf('\u0001') > 0) {
            self._handleCTCP(from, to, text, 'notice', message);
            break;
        }
        self.emit('notice', from, to, text, message);

        if (self.opt.debug && to == self.nick)
            util.log('GOT NOTICE from ' + (from ? '"' + from + '"' : 'the server') + ': "' + text + '"');
    }

    private onMode(msg: IMessage) {
        self._casemap(message, 0);
        if (self.opt.debug)
            util.log('MODE: ' + message.args[0] + ' sets mode: ' + message.args[1]);

        channel = self.chanData(message.args[0]);
        if (!channel) break;
        var modeList = message.args[1].split('');
        var adding = true;
        var modeArgs = message.args.slice(2);
        modeList.forEach(function(mode) {
            if (mode == '+') {
                adding = true;
                return;
            }
            if (mode == '-') {
                adding = false;
                return;
            }
            if (mode in self.prefixForMode) {
                // channel user modes
                var user = modeArgs.shift();
                if (adding) {
                    if (channel.users[user] != null && channel.users[user].indexOf(self.prefixForMode[mode]) === -1) {
                        channel.users[user] += self.prefixForMode[mode];
                    }

                    self.emit('+mode', message.args[0], message.nick, mode, user, message);
                }
                else {
                    if (channel.users[user]) {
                        channel.users[user] = channel.users[user].replace(self.prefixForMode[mode], '');
                    }
                    self.emit('-mode', message.args[0], message.nick, mode, user, message);
                }
            }
            else {
                var modeArg;
                // channel modes
                if (mode.match(/^[bkl]$/)) {
                    modeArg = modeArgs.shift();
                    if (!modeArg || modeArg.length === 0)
                        modeArg = undefined;
                }
                // TODO - deal nicely with channel modes that take args
                if (adding) {
                    if (channel.mode.indexOf(mode) === -1)
                        channel.mode += mode;

                    self.emit('+mode', message.args[0], message.nick, mode, modeArg, message);
                }
                else {
                    channel.mode = channel.mode.replace(mode, '');
                    self.emit('-mode', message.args[0], message.nick, mode, modeArg, message);
                }
            }
        });
    }

    private onNick(msg: IMessage) {
        if (message.nick == self.nick) {
            // the user just changed their own nick
            self.nick = message.args[0];
            self._updateMaxLineLength();
        }

        if (self.opt.debug)
            util.log('NICK: ' + message.nick + ' changes nick to ' + message.args[0]);

        channels = [];

        // finding what channels a user is in
        Object.keys(self.chans).forEach(function(channame) {
            var channel = self.chans[channame];
            if (message.nick in channel.users) {
                channel.users[message.args[0]] = channel.users[message.nick];
                delete channel.users[message.nick];
                channels.push(channame);
            }
        });

        // old nick, new nick, channels
        self.emit('nick', message.nick, message.args[0], channels, message);
    }

    public onMessage (msg: IMessage) {
        switch (msg.command) {
           case 'rpl_welcome':
               this.onWelcome(msg);
               break;
           case 'rpl_myinfo':
               this.client.supported.usermodes = msg.args[3];
               break;
           case 'rpl_isupport':
              this.onISupport(msg);
               break;
           case 'rpl_yourhost':
           case 'rpl_created':
           case 'rpl_luserclient':
           case 'rpl_luserop':
           case 'rpl_luserchannels':
           case 'rpl_luserme':
           case 'rpl_localusers':
           case 'rpl_globalusers':
           case 'rpl_statsconn':
           case 'rpl_luserunknown':
               // Random welcome crap, ignoring
               break;
           case 'err_nicknameinuse':
               break;
           case 'PING':
               this.client.send('PONG', msg.args[0]);
               this.client.emit('ping', msg.args[0]);
               break;
           case 'PONG':
               this.client.emit('pong', msg.args[0]);
               break;
           case 'NOTICE':
               this.onNotice(msg);
               break;
           case 'MODE':
               this.onMode(msg);
               break;
           case 'NICK':
               break;
           case 'rpl_motdstart':
               this.client.appendMotd(msg.args[1] + '\n', true);
               break;
           case 'rpl_motd':
               this.client.appendMotd(msg.args[1] + '\n');
               break;
           case 'rpl_endofmotd':
           case 'err_nomotd':
               this.client.appendMotd(msg.args[1] + '\n', false);
               break;
           case 'rpl_namreply':
               self._casemap(message, 2);
               channel = self.chanData(message.args[2]);
               if (!message.args[3]) {
                   // No users
                   break;
               }
               var users = message.args[3].trim().split(/ +/);
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
                           var knownPrefixes = '';
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
                               // We know it isn't a mode char.
                               channel.users[match[1] + match[2]] = '';
                           }
                       }
                   });
               }
               break;
           case 'rpl_endofnames':
               self._casemap(message, 1);
               channel = self.chanData(message.args[1]);
               if (channel) {
                   self.emit('names', message.args[1], channel.users);
                   self.emit('names' + message.args[1], channel.users);
                   self.send('MODE', message.args[1]);
               }
               break;
           case 'rpl_topic':
               self._casemap(message, 1);
               channel = self.chanData(message.args[1]);
               if (channel) {
                   channel.topic = message.args[2];
               }
               break;
           case 'rpl_away':
               self._addWhoisData(message.args[1], 'away', message.args[2], true);
               break;
           case 'rpl_whoisuser':
               self._addWhoisData(message.args[1], 'user', message.args[2]);
               self._addWhoisData(message.args[1], 'host', message.args[3]);
               self._addWhoisData(message.args[1], 'realname', message.args[5]);
               break;
           case 'rpl_whoisidle':
               self._addWhoisData(message.args[1], 'idle', message.args[2]);
               break;
           case 'rpl_whoischannels':
              // TODO - clean this up?
               if (message.args.length >= 3)
                   self._addWhoisData(message.args[1], 'channels', message.args[2].trim().split(/\s+/));
               break;
           case 'rpl_whoisserver':
               self._addWhoisData(message.args[1], 'server', message.args[2]);
               self._addWhoisData(message.args[1], 'serverinfo', message.args[3]);
               break;
           case 'rpl_whoisoperator':
               self._addWhoisData(message.args[1], 'operator', message.args[2]);
               break;
           case '330': // rpl_whoisaccount?
               self._addWhoisData(message.args[1], 'account', message.args[2]);
               self._addWhoisData(message.args[1], 'accountinfo', message.args[3]);
               break;
           case 'rpl_endofwhois':
               self.emit('whois', self._clearWhoisData(message.args[1]));
               break;
           case 'rpl_liststart':
               self.channellist = [];
               self.emit('channellist_start');
               break;
           case 'rpl_list':
               channel = {
                   name: message.args[1],
                   users: message.args[2],
                   topic: message.args[3]
               };
               self.emit('channellist_item', channel);
               self.channellist.push(channel);
               break;
           case 'rpl_listend':
               self.emit('channellist', self.channellist);
               break;
           case 'rpl_topicwhotime':
               self._casemap(message, 1);
               channel = self.chanData(message.args[1]);
               if (channel) {
                   channel.topicBy = message.args[2];
                   // channel, topic, nick
                   self.emit('topic', message.args[1], channel.topic, channel.topicBy, message);
               }
               break;
           case 'TOPIC':
               // channel, topic, nick
               self._casemap(message, 0);
               self.emit('topic', message.args[0], message.args[1], message.nick, message);

               channel = self.chanData(message.args[0]);
               if (channel) {
                   channel.topic = message.args[1];
                   channel.topicBy = message.nick;
               }
               break;
           case 'rpl_channelmodeis':
               self._casemap(message, 1);
               channel = self.chanData(message.args[1]);
               if (channel) {
                   channel.mode = message.args[2];
               }

               self.emit('mode_is', message.args[1], message.args[2]);
               break;
           case 'rpl_creationtime':
               self._casemap(message, 1);
               channel = self.chanData(message.args[1]);
               if (channel) {
                   channel.created = message.args[2];
               }
               break;
           case 'JOIN':
               self._casemap(message, 0);
               // channel, who
               if (self.nick == message.nick) {
                   self.chanData(message.args[0], true);
               }
               else {
                   channel = self.chanData(message.args[0]);
                   if (channel && channel.users) {
                       channel.users[message.nick] = '';
                   }
               }
               self.emit('join', message.args[0], message.nick, message);
               self.emit('join' + message.args[0], message.nick, message);
               if (message.args[0] != message.args[0].toLowerCase()) {
                   self.emit('join' + message.args[0].toLowerCase(), message.nick, message);
               }
               break;
           case 'PART':
               self._casemap(message, 0);
               // channel, who, reason
               self.emit('part', message.args[0], message.nick, message.args[1], message);
               self.emit('part' + message.args[0], message.nick, message.args[1], message);
               if (message.args[0] != message.args[0].toLowerCase()) {
                   self.emit('part' + message.args[0].toLowerCase(), message.nick, message.args[1], message);
               }
               if (self.nick == message.nick) {
                   channel = self.chanData(message.args[0]);
                   delete self.chans[channel.key];
               }
               else {
                   channel = self.chanData(message.args[0]);
                   if (channel && channel.users) {
                       delete channel.users[message.nick];
                   }
               }
               break;
           case 'KICK':
               self._casemap(message, 0);
               // channel, who, by, reason
               self.emit('kick', message.args[0], message.args[1], message.nick, message.args[2], message);
               self.emit('kick' + message.args[0], message.args[1], message.nick, message.args[2], message);
               if (message.args[0] != message.args[0].toLowerCase()) {
                   self.emit('kick' + message.args[0].toLowerCase(),
                             message.args[1], message.nick, message.args[2], message);
               }

               if (self.nick == message.args[1]) {
                   channel = self.chanData(message.args[0]);
                   delete self.chans[channel.key];
               }
               else {
                   channel = self.chanData(message.args[0]);
                   if (channel && channel.users) {
                       delete channel.users[message.args[1]];
                   }
               }
               break;
           case 'KILL':
               nick = message.args[0];
               channels = [];
               Object.keys(self.chans).forEach(function(channame) {
                   var channel = self.chans[channame];
                   if (nick in channel.users) {
                       channels.push(channame);
                       delete channel.users[nick];
                   }
               });
               self.emit('kill', nick, message.args[1], channels, message);
               break;
           case 'PRIVMSG':
               self._casemap(message, 0);
               from = message.nick;
               to = message.args[0];
               text = message.args[1] || '';
               if (text[0] === '\u0001' && text.lastIndexOf('\u0001') > 0) {
                   self._handleCTCP(from, to, text, 'privmsg', message);
                   break;
               }
               self.emit('message', from, to, text, message);
               if (self.supported.channel.types.indexOf(to.charAt(0)) !== -1) {
                   self.emit('message#', from, to, text, message);
                   self.emit('message' + to, from, text, message);
                   if (to != to.toLowerCase()) {
                       self.emit('message' + to.toLowerCase(), from, text, message);
                   }
               }
               if (to.toUpperCase() === self.nick.toUpperCase()) self.emit('pm', from, text, message);

               if (self.opt.debug && to == self.nick)
                   util.log('GOT MESSAGE from ' + from + ': ' + text);
               break;
           case 'INVITE':
               self._casemap(message, 1);
               from = message.nick;
               to = message.args[0];
               channel = message.args[1];
               self.emit('invite', channel, from, message);
               break;
           case 'QUIT':
               if (self.opt.debug)
                   util.log('QUIT: ' + message.prefix + ' ' + message.args.join(' '));
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
               self.emit('quit', message.nick, message.args[0], channels, message);
               break;

           // for sasl
           case 'CAP':
               if (message.args[0] === '*' &&
                    message.args[1] === 'ACK' &&
                    message.args[2] === 'sasl ') // there's a space after sasl
                   self.send('AUTHENTICATE', 'PLAIN');
               break;
           case 'AUTHENTICATE':
               if (message.args[0] === '+') self.send('AUTHENTICATE',
                   new Buffer(
                       self.opt.nick + '\0' +
                       self.opt.userName + '\0' +
                       self.opt.password
                   ).toString('base64'));
               break;
           case '903':
               self.send('CAP', 'END');
               break;
           case 'err_unavailresource':
           // err_unavailresource has been seen in the wild on Freenode when trying to
           // connect with the nick 'boot'. I'm guessing they have reserved that nick so
           // no one can claim it. The error handling though is identical to offensive word
           // nicks hence the fall through here.
           case 'err_erroneusnickname':
               if (self.opt.showErrors)
                   util.log('\033[01;31mERROR: ' + util.inspect(message) + '\033[0m');

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
               if (self.hostMask !== '') { // hostMask set on rpl_welcome
                   self.emit('error', message);
                   break;
               }
               // rpl_welcome has not been sent
               // We can't use a truly random string because we still need to abide by
               // the BNF for nicks (first char must be A-Z, length limits, etc). We also
               // want to be able to debug any issues if people say that they didn't get
               // the nick they wanted.
               var rndNick = "enick_" + Math.floor(Math.random() * 1000) // random 3 digits
               self.send('NICK', rndNick);
               self.nick = rndNick;
               self._updateMaxLineLength();
               break;

           default:
               if (message.commandType == 'error') {
                   self.emit('error', message);
                   if (self.opt.showErrors)
                       util.log('\u001b[01;31mERROR: ' + util.inspect(message) + '\u001b[0m');
               }
               else {
                   if (self.opt.debug)
                       util.log('\u001b[01;31mUnhandled message: ' + util.inspect(message) + '\u001b[0m');
                   break;
               }
       }
        });
    }
}
