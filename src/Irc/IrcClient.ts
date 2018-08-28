import { Socket, SocketConnectOpts, SocketConstructorOpts } from "net";
import { ConfigServer } from "../Config";
import { Log } from "../Log";
import { TcpSocketConnectOpts } from "net";
import { ERRCODES, IErrorResponse} from "../Rest/ErrorResponse";

export interface IrcConnectionOpts {
    nicknames: string | string[],
    connectionTimeout: number,
}

export class IrcClient extends Socket {
    private log: Log;

    constructor(private uuid: string, private ircOpts: IrcConnectionOpts, opts?: SocketConstructorOpts) {
       super(opts);
       this.log = new Log("Cli#"+this.uuid.substr(0,12));
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
            }, this.ircOpts.connectionTimeout || 10000);
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
                this.ircSetup();
                resolve();
            });
            this.log.verbose(`Begun connection.`);
        });
    }
    
    public ircSetup() {
        this.write("CONNECT hello!\n");
    }
 }
 