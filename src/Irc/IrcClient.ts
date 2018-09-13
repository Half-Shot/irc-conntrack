import { Socket, SocketConnectOpts, SocketConstructorOpts } from "net";
import { ConfigServer } from "../Config";
import { Log } from "../Log";
import { TcpSocketConnectOpts } from "net";
import { ERRCODES, IErrorResponse} from "../Rest/ErrorResponse";
import { IIrcSupported, getDefaultSupported } from "./IrcSupported";
import { IrcUtil } from "./IrcUtil";
import { parseMessage, IMessage } from "./IMessage";
// import { MessageParser } from "./MessageParser";

const DEFAULT_CONNECTION_TIMEOUT_MS = 10000;
const BUFFER_SIZE = 1024;
const LINE_DELIMITER = new RegExp("\r\n|\r|\n");

export interface IrcConnectionOpts {
    nicknames: string | string[];
    connectionTimeout: number;
    detectEncoding: boolean;
    stripColors: boolean;
    ignoreBadMessages: boolean;
}

export class IrcClient extends Socket {
    public supported: IIrcSupported;
    private serverMotd: string = "";
    private log: Log;
    private dataBuffer: Buffer;
    private dataBufferLength: number;
    private requestedDisconnect: boolean = false;
    // private msgParser: MessageParser;
    private nick?: string;
    private whoisData: Map<string, any> = new Map();
    private chanlist: string[] = [];
    private mode: string = "";

    constructor(readonly uuid: string, private ircOpts: IrcConnectionOpts, opts?: SocketConstructorOpts) {
        super(opts);
        const LOG_UUID_LENGTH = 12;
        this.log = new Log("Cli#" + this.uuid.substr(0, LOG_UUID_LENGTH));
        this.supported = getDefaultSupported();
        this.dataBuffer = Buffer.alloc(BUFFER_SIZE);
        this.dataBufferLength = 0;
        // this.msgParser = new MessageParser(this);
        // TODO: Message parser emits lots of things.
    }

    public get motd() {
        return this.serverMotd;
    }

    public get nickname() {
        return this.nick;
    }

    public get channels() {
        return this.chanlist;
    }

    public get usermode() {
        return this.mode;
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
                this.ircSetup().then(() => {
                    resolve();
                });
            });
            this.log.verbose(`Connecting..`);
        });
    }

    public ircSetup(): Promise<void> {
        return this.send("CONNECT hello!\n");
    }

    /*- State Setting Functions: To be moved to a state interface */

    public appendMotd(text: string, clear: boolean = false, finished: boolean = false) {
        if (clear) {
            this.serverMotd = "";
        }
        this.serverMotd += text;
        if (finished) {
            this.emit("motd", this.serverMotd);
        }
    }

    public setGivenNick(nick: string) {
        this.nick = nick;
    }

    public setWhoisData(nick: string, key: string, value: string|string[], ifExists: boolean= false) {
        if (ifExists && !this.whoisData.has(nick)) {
            return;
        }
        const whois = this.whoisData.get(nick) || {nick};
        whois[key] = value;
    }

    public addChannel(name: string, users: string, topic: string) {

    }

    /* Command functions for IRC */

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

    public whois(nick?: string): Promise<any> {
        if (nick === undefined) {
            nick = this.nick;
            if (nick === undefined) {
                return Promise.reject("Own nick not known yet");
            }
        }
        return this.send("whois", nick);
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
                    // this.msgParser.onMessage(message);
                } catch (err) {
                    if (!this.ircOpts.ignoreBadMessages && !this.requestedDisconnect) {
                        throw err;
                    }
                }
            }
        });
    }
 }
