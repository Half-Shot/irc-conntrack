import { Socket, SocketConnectOpts, SocketConstructorOpts } from "net";
import { ConfigServer } from "../Config";
import { Log } from "../Log";
import { TcpSocketConnectOpts } from "net";
import { ERRCODES, IErrorResponse} from "../Rest/ErrorResponse";
import { IIrcSupported, getDefaultSupported } from "./IrcSupported";
import { IrcUtil } from "./IrcUtil";
import { parseMessage, IMessage } from "./IMessage";
//import { MessageParser } from "./MessageParser";

const DEFAULT_CONNECTION_TIMEOUT_MS = 10000;
const LINE_DELIMITER = new RegExp('\r\n|\r|\n')


export interface IrcConnectionOpts {
    nicknames: string | string[],
    connectionTimeout: number,
    detectEncoding: boolean,
    stripColors: boolean,
}

export class IrcClient extends Socket {
    public supported: IIrcSupported;
    private _motd: string = "";
    private log: Log;
    private dataBuffer: Buffer;
    private requestedDisconnect: Boolean = false;
    //private msgParser: MessageParser;
    private nick?: string;
    private whoisData: Map<string,any> = new Map();
    private _channels: string[] = [];
    private mode: string = "";

    constructor(readonly uuid: string, private ircOpts: IrcConnectionOpts, opts?: SocketConstructorOpts) {
        super(opts);
        this.log = new Log("Cli#"+this.uuid.substr(0,12));
        this.supported = getDefaultSupported();
        this.dataBuffer = Buffer.alloc(0);
        //this.msgParser = new MessageParser(this);
        //TODO: Message parser emits lots of things.
    }

    public get motd() {
        return this._motd;
    }

    public get nickname() {
        return this.nick;
    }

    public get channels() {
        return this._channels;
    }

    public get usermode() {
        return this.mode;
    }

    public initiate(serverName: string, server: ConfigServer) : Promise<undefined> {
        this.log.info(`Creating new connection for ${serverName}`);
        const address = server.addressTuple[0];
        const socketConnectOpts: TcpSocketConnectOpts = {
            port: address.port,
            host: address.host,
            family: server.isIpv6 ? 6 : 4,
        };
        return new Promise((resolve, reject) => {
            this.log.verbose(`Connecting to ${address.host}:${address.port}`);
            const timeout = setTimeout(() => {
                this.log.warn(`imed out waiting for connection to ${address.host}:${address.port}`);
                this.destroy(new Error("Timeout waiting for connection"));
                reject(
                    {error: "Timed out connecting", errcode: ERRCODES.timeout} as IErrorResponse
                );
            }, this.ircOpts.connectionTimeout || DEFAULT_CONNECTION_TIMEOUT_MS);
            this.once("error", (err) => {
                this.log.warn(`Error connecting:`, err);
                this.destroy();
                reject(
                    {error: err.message, errcode: ERRCODES.genericFail} as IErrorResponse
                );
                clearTimeout(timeout);
            });
            this.connect(socketConnectOpts, () => {
                clearTimeout(timeout);
                this.log.info(`Connected.`);
                if (!this.ircOpts.detectEncoding) {
                    this.setEncoding("utf-8");
                }
                this.on("data", this.onData.bind(this));
                this.ircSetup();
                resolve();
            });
            this.log.verbose(`Begun connection.`);
        });
    }

    public ircSetup() {
        this.write("CONNECT hello!\n");
    }

    /*- State Setting Functions: To be moved to a state interface */

    public appendMotd(text: string, clear: boolean = false, finished: boolean = false) {
        if (clear) {
            this._motd = "";
        }
        this._motd += text;
        if (finished) {
            this.emit("motd", this._motd);
        }
    }

    public setGivenNick(nick: string) {
        this.nick = nick;
    }

    public setWhoisData(nick: string, key: string, value: string|string[], ifExists: boolean=false) {
        if (ifExists && !this.whoisData.has(nick)) {
            return;
        }
        const whois = this.whoisData.get(nick) || {nick};
        whois[key] = value;
    }

    public addChannel(name: string, users: string, topic: string) {

    }

    /* Command functions for IRC */

    public send(...args: string[]) {
        if (!this.requestedDisconnect) {
            return;
        }

        // Note that the command arg is included in the args array as the first element
        if (args[args.length - 1].match(/\s/) || args[args.length - 1].match(/^:/) || args[args.length - 1] === '') {
            args[args.length - 1] = ':' + args[args.length - 1];
        }
        const msg = args.join(' ');
        this.log.silly(`TX:"${msg}"`);
        this.write(msg + "\r\n");
    }

    public whois(nick?: string): Promise<any>|undefined {
        if (nick === undefined) {
            nick = this.nick;
            if (nick === undefined) {
                return Promise.reject("Own nick not known yet");
            }
        }
        this.send("whois", nick);
    }

    private onData(chunk: string|Buffer) {
        if (typeof (chunk) === 'string') {
            this.dataBuffer.write(chunk);
        } else {
            this.dataBuffer = Buffer.concat([this.dataBuffer, chunk]);
        }

        const lines = IrcUtil.convertEncoding(
            this.dataBuffer,
            this.ircOpts.detectEncoding,
        ).toString().split(LINE_DELIMITER);

        if (lines.pop()) {
            // if buffer is not ended with \r\n, there's more chunks.
            return;
        } else {
            this.log.silly(`RX:"${this.dataBuffer.toString("utf-8")}"`);
            // else, initialize the buffer.
            this.dataBuffer = Buffer.alloc(0);
        }

        lines.forEach((line) => {
            if (line.length) {
                const message = parseMessage(line, this.ircOpts.stripColors);
                try {
                    this.emit("raw", message);
                    //this.msgParser.onMessage(message);
                } catch (err) {
                    if (!this.requestedDisconnect) {
                        throw err;
                    }
                }
            }
        });
    }
 }
