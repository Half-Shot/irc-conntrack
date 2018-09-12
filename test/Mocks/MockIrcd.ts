import { Server, Socket } from "net";

export class MockIrcd {
    private listener: Server;
    public running: boolean;
    public dataRecieved: string;
    public connections: number;
    private sockets: Socket[];

    public dataCount: number;
    private dataPromiseTrigger: any;
    private dataExpecting: number;

    constructor() {
        this.listener = new Server((conn) => {this.onConnection(conn);});
        this.dataRecieved = "";
        this.dataExpecting = -1;
        this.connections = 0;
        this.running = false;
        this.dataCount = 0;
        this.sockets = [];
    }

    public spinUp(): Promise<void> {
        this.listener.listen(5544, "127.0.0.1");
        return new Promise((resolve, reject) => {
            this.listener.once("error", (err) => {
                reject(err);
            });
            this.listener.once("listening", () => {
                this.running = true;
                resolve();
            });
        });
    }

    public spinDown(): Promise<void> {
        if (!this.running) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            this.listener.close(() => {
                this.running = false;
                resolve();
            });
        });
    }

    public waitForData(expectedCount: number, timeout: number): Promise<void> {
        this.dataExpecting = expectedCount;
        return new Promise((resolve, reject) => {
            const tOut = setTimeout(() => {
                this.dataPromiseTrigger = undefined;
                reject();
            }, timeout);
            this.dataPromiseTrigger = () => {
                resolve();
                this.dataPromiseTrigger = undefined;
                clearTimeout(tOut);
            };
        });
    }

    public send(msg: string, index: number = 0): Promise<void> {
        return new Promise((resolve) => {
            this.sockets[index].write(msg, () => {
                resolve();
            });
        });
    }

    private onConnection(conn: Socket) {
        conn.on("data", (data) => {this.onData(data);});
        conn.on("close", () => {
            this.sockets.splice(this.sockets.findIndex((c) => c === conn), 0);
        });
        this.sockets.push(conn);
        this.connections++;
    }

    private onData(data: Buffer|string) {
        this.dataRecieved += typeof(data) !== "string" ? data.toString("utf-8") : data;
        this.dataCount++;
        if (this.dataPromiseTrigger && this.dataExpecting === this.dataCount) {
            this.dataPromiseTrigger();
        }
    }
}
