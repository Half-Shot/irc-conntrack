import { Socket, SocketConnectOpts, SocketConstructorOpts } from "net";
import { ConfigServer } from "../Config";
import { Log } from "../Log";
import { TcpSocketConnectOpts } from "net";
import { ERRCODES, IErrorResponse} from "../Rest/IErrorResponse";
import { IIrcSupported, getDefaultSupported } from "./IrcSupported";
import { IrcUtil } from "./IrcUtil";
import { parseMessage, IMessage } from "./IMessage";
import { MessageParser } from "./MessageParser";
import { IrcState } from "./IrcState";
import { INames } from "./Messages/INames";
import { ISupports } from "./Messages/ISupports";

const DEFAULT_CONNECTION_TIMEOUT_MS = 10000;
const BUFFER_SIZE = 1024;
const LINE_DELIMITER = new RegExp("\r\n|\r|\n");

const NICK_CONFLICT_STRAT_NEXT_NICK = 0;
const NICK_CONFLICT_STRAT_APPEND_NUMBER = 1;

export interface IrcConnectionOpts {
    nicknames: string | string[];
    realname: string;
    username: string;
    connectionTimeout: number;
    detectEncoding: boolean;
    stripColors: boolean;
    ignoreBadMessages: boolean;
    sasl: boolean;
    password?: string;
    nicknameConflictStrategy?: number;
}

export class IrcClient extends Socket {
    public supported: IIrcSupported;
    private state: IrcState;
    private log: Log;
    private dataBuffer: Buffer;
    private dataBufferLength: number;
    private requestedDisconnect: boolean = false;
    private msgParser: MessageParser;

    constructor(readonly uuid: string, private ircOpts: IrcConnectionOpts, opts?: SocketConstructorOpts) {
        super(opts);
        const LOG_UUID_LENGTH = 12;
        this.log = new Log("Cli#" + this.uuid.substr(0, LOG_UUID_LENGTH));
        this.supported = getDefaultSupported();
        this.dataBuffer = Buffer.alloc(BUFFER_SIZE);
        this.dataBufferLength = 0;
        this.state = new IrcState();
        this.state.requestedNickname = Array.isArray(this.ircOpts.nicknames) ?
            this.ircOpts.nicknames[0] : this.ircOpts.nicknames;
        this.msgParser = new MessageParser(this.uuid, this.state, this.supported);
        this.msgParser.on("registered", this.onRegistered.bind(this));
        this.msgParser.on("nickname_in_use", this.onNeedNewNick.bind(this));
        this.msgParser.on("nickname_unacceptable", this.onNeedNewNick.bind(this));
        this.msgParser.on("ping", (pingstring: string) => {
            this.send("PONG", pingstring);
        });
        this.msgParser.on("names", (names: INames) => {
            // Get the mode as well.
            this.send("MODE", names.channel);
        });
        this.msgParser.on("saslsuccess", () => {
            // We are logged in, so finished capabilities.
            this.send("CAP", "END");
        });
        this.msgParser.on("supports", (supports: ISupports) => {
            if (supports.supports === "sasl") {
                this.send("AUTHENTICATE", "PLAIN");
            }
        });
        this.msgParser.on("auth", (plus) => {
            if (plus !== "+") {
                // Not sure why, but we sure want a +.
                return;
            }
            this.send(
                "AUTHENTICATE",
                new Buffer(
                    this.state.nick + "\0" +
                    this.ircOpts.username + "\0" +
                    this.ircOpts.password as string,
                ).toString("base64"),
            );
        });
    }

    public get motd() {
        return this.state.motd;
    }

    public get nickname() {
        return this.state.nick;
    }

    public get channels() {
        return this.state.channelList;
    }

    public get usermode() {
        return this.state.usermode;
    }

    public get ircState() {
        return Object.assign({}, this.state);
    }

    /**
     * Use this to listen for parsed  messages from the IRC connection.
     */
    public get msgEmitter() {
        return this.msgParser;
    }

    public initiate(server: ConfigServer): Promise<undefined> {
        this.log.info(`Creating new connection for ${server.name}`);
        const address = server.addressTuple[0];
        const socketConnectOpts: TcpSocketConnectOpts = {
            port: address.port,
            host: address.host,
            // tslint:disable-next-line:no-magic-numbers
            family: server.isIpv6 ? 6 : 4,
        };
        return new Promise((resolve, reject) => {
            this.log.verbose(`Connecting to ${address.host}:${address.port}`);
            const timeout = setTimeout(() => {
                this.log.warn(`Timed out waiting for connection to ${address.host}:${address.port}`);
                const e = new Error("Timeout waiting for connection");
                this.destroy(e);
                reject(e);
            }, this.ircOpts.connectionTimeout || DEFAULT_CONNECTION_TIMEOUT_MS);
            const errorHandler = (err: Error) => {
                clearTimeout(timeout);
                this.log.warn(`Error connecting:`, err);
                this.destroy();
                reject(err);
            };
            this.once("error", errorHandler);
            this.connect(socketConnectOpts, () => {
                clearTimeout(timeout);
                this.log.info(`Connected`);
                this.removeListener("error", errorHandler);
                if (!this.ircOpts.detectEncoding) {
                    this.setEncoding("utf-8");
                }
                this.on("data", this.onData.bind(this));
                this.onConnected().then(() => {
                    resolve();
                });
            });
            this.log.verbose(`Connecting..`);
        });
    }

    public send(...args: string[]): Promise<void> {
        if (this.requestedDisconnect) {
            return Promise.resolve();
        }

        // Note that the command arg is included in the args array as the first element
        if (args[args.length - 1].match(/\s/) || args[args.length - 1].match(/^:/) || args[args.length - 1] === "") {
            args[args.length - 1] = ":" + args[args.length - 1];
        }
        const msg = args.join(" ");
        this.log.silly(`TX:"${msg}"`);
        return new Promise((resolve) => {
            this.write(msg + "\r\n", "utf-8", () => {resolve(); });
        });
    }

    public async whois(nick?: string): Promise<any> {
        if (nick === undefined) {
            nick = this.state.nick;
            if (nick === undefined) {
                return Promise.reject("Own nick not known yet");
            }
        }
        const p = new Promise((resolve) => {
            this.msgParser.on("whois", () => {
                resolve(this.state.whoisData.get(nick as string));
            });
        });
        await this.send("whois", nick);
        return p;
    }

    // Client.prototype._handleCTCP = function(from, to, text, type, message) {
    //     text = text.slice(1);
    //     text = text.slice(0, text.indexOf('\u0001'));
    //     var parts = text.split(' ');
    //     this.emit('ctcp', from, to, text, type, message);
    //     this.emit('ctcp-' + type, from, to, text, message);
    //     if (type === 'privmsg' && text === 'VERSION')
    //         this.emit('ctcp-version', from, to, message);
    //     if (parts[0] === 'ACTION' && parts.length > 1)
    //         this.emit('action', from, to, parts.slice(1).join(' '), message);
    //     if (parts[0] === 'PING' && type === 'privmsg' && parts.length > 1)
    //         this.ctcp(from, 'notice', text);
    // };

    private onConnected(): Promise<void> {
        // TODO: Webirc support.
        const sendPromises = [];
        if (this.ircOpts.sasl) {
            this.log.info("Requesting SASL capabilities");
            sendPromises.push(this.send("CAP REQ", "sasl"));
        } else if (this.ircOpts.password) {
            this.log.info("Using provided password");
            sendPromises.push(this.send("PASS", this.ircOpts.password));
        }
        sendPromises.push(this.send("NICK", this.state.requestedNickname));
        // Assume this is the case unless we are told otherwise.
        this.state.nick = this.state.requestedNickname;
        this.state.updateMaxLineLength();
        // Bitmap: https://tools.ietf.org/html/rfc2812#section-3.1.5
        const USERMODE = "8";
        sendPromises.push(this.send("USER", this.ircOpts.username, USERMODE, "*", this.ircOpts.realname));
        this.emit("connect");
        return Promise.all(sendPromises).then(() => { /* To stop typescript making this void[]*/ });
    }

    private onData(chunk: string|Buffer) {
        const DELIMITER = "\r\n";
        let finished;
        if (typeof (chunk) === "string") {
            this.dataBuffer.write(chunk);
            finished = chunk.endsWith(DELIMITER);
        } else {
            chunk.copy(this.dataBuffer, this.dataBufferLength);
            finished = chunk.slice(chunk.length - 2, 2).equals(new Uint8Array([
                DELIMITER.charCodeAt(0),
                DELIMITER.charCodeAt(1),
            ]));
        }
        this.dataBufferLength += chunk.length;
        if (this.dataBufferLength > BUFFER_SIZE) {
            this.dataBuffer.fill(0, 0);
            this.emit("error", "Buffer size limit reached for IRC message");
            return;
        }
        if (!finished) {
            return;
        }
        const lines = IrcUtil.convertEncoding(
            this.dataBuffer.slice(0, this.dataBufferLength),
            this.ircOpts.detectEncoding,
        ).toString().split(LINE_DELIMITER);
        // Clear the buffer
        this.dataBuffer.fill(0, 0);
        this.log.silly(`RX:"${lines.join()}"`);
        lines.forEach((line) => {
            if (line.length) {
                try {
                    const message = parseMessage(line, this.ircOpts.stripColors);
                    this.emit("raw", message);
                    if (message.badFormat) {
                        throw new Error("Bad format");
                    }
                    this.msgParser.actOnMessage(message);
                } catch (err) {
                    if (!this.ircOpts.ignoreBadMessages && !this.requestedDisconnect) {
                        throw err;
                    }
                }
            }
        });
    }

    private async onRegistered() {
        await this.whois(this.nickname);
        // TODO: Need to update nick, hostname and maxlinelength with this.
    }

    private onNeedNewNick() {
        let newNick;
        if (this.ircOpts.nicknameConflictStrategy === NICK_CONFLICT_STRAT_APPEND_NUMBER) {
            // TODO: Complete this.
            throw new Error("Cannot set nick: NICK_CONFLICT_STRAT_APPEND_NUMBER not implemented.");
        } else { // Defaults to: NICK_CONFLICT_STRAT_NEXT_NICK
            if (Array.isArray(this.ircOpts.nicknames)) {
                newNick = this.ircOpts.nicknames.pop();
            }
        }
        if (!newNick) {
            throw new Error("Cannot set nick: no more nicknames to try");
        }
        this.state.requestedNickname = newNick;
        this.send("NICK", this.state.requestedNickname);
        // Assume this is the case unless we are told otherwise.
        this.state.nick = this.state.requestedNickname;
        this.state.updateMaxLineLength();
    }

 }
