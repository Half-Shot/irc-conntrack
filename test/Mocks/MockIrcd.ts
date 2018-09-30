import { Server, Socket } from "net";

export class MockIrcd {
    public running: boolean;
    public dataRecieved: string;
    public connections: number;

    public dataCount: number;
    private listener: Server;
    private sockets: Socket[];
    private dataPromiseTrigger?: () => void;
    private dataExpecting: number;

    constructor() {
        this.listener = new Server((conn) => {this.onConnection(conn); });
        this.dataRecieved = "";
        this.dataExpecting = -1;
        this.connections = 0;
        this.running = false;
        this.dataCount = 0;
        this.sockets = [];
    }

    public spinUp(port: number = 5544): Promise<void> {
        this.listener.listen(port, "127.0.0.1");
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

    public waitForData(expectedCount: number, timeout?: number): Promise<void> {
        this.dataExpecting = expectedCount;
        return new Promise((resolve, reject) => {
            const tOut = timeout !== null ? setTimeout(() => {
                this.dataPromiseTrigger = undefined;
                reject();
            }, timeout) : undefined;
            this.dataPromiseTrigger = () => {
                resolve();
                this.dataPromiseTrigger = undefined;
                clearTimeout(tOut as number);
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

    public clear() {
        this.dataCount = 0;
        this.dataRecieved = "";
    }

    private onConnection(conn: Socket) {
        conn.on("data", (data) => {this.onData(data); });
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
