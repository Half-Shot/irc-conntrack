import { Socket, SocketConnectOpts, SocketConstructorOpts } from "net";
import { ConfigServer } from "../Config";
import { Log } from "../Log";
import { TcpSocketConnectOpts } from "net";
import { ERRCODES, IErrorResponse} from "../Rest/ErrorResponse";
import { IIrcSupported } from "./IrcSupported";
import { IrcUtil } from "./IrcUtil";
import { parseMessage, IMessage } from "./IMessage";

const DEFAULT_CONNECTION_TIMEOUT_MS = 10000;
const LINE_DELIMITER = new RegExp('\r\n|\r|\n')


export interface IrcConnectionOpts {
    nicknames: string | string[],
    connectionTimeout: number,
    detectEncoding: boolean,
    stripColors: boolean,
}

export class IrcClient extends Socket {
    private supported: IIrcSupported;
    private log: Log;
    private dataBuffer: Buffer;
    private requestedDisconnect: Boolean = false;

    constructor(private uuid: string, private ircOpts: IrcConnectionOpts, opts?: SocketConstructorOpts) {
        super(opts);
        this.ircOpts.stripColors = !(this.ircOpts.stripColors === false);
        this.log = new Log("Cli#"+this.uuid.substr(0,12));
        this.supported = {
            casemapping: "",
        };
        this.dataBuffer = Buffer.alloc(0);
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
            // else, initialize the buffer.
            this.dataBuffer = Buffer.alloc(0);
        }

        lines.forEach((line) => {
            if (line.length) {
                const message = parseMessage(line, this.ircOpts.stripColors);
                try {
                    this.onRawMessage(message);
                } catch (err) {
                    if (!this.requestedDisconnect) {
                        throw err;
                    }
                }
            }
        });
    }

    private onRawMessage(msg: IMessage) {
        this.emit("raw", msg);
    }
 }
 