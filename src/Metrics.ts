import {collectDefaultMetrics, register, Gauge, Counter} from "prom-client";
import {ConfigMetrics} from "./Config";

export class Metrics {
    public static getMetrics() {
        return register.metrics();
    }

    public static Configure(config: ConfigMetrics) {
        Metrics.config = config;
        collectDefaultMetrics({ prefix: config.prefix, timeout: Metrics.config.defaultMetricsCollectionInterval});
    }

    public static get ircConnectionCountGauge() {
        return Metrics.ircConnCount;
    }

    public static get ircMessagesReceived() {
        return Metrics.ircMsgRx;
    }

    public static get ircMessagesSent() {
        return Metrics.ircMsgTx;
    }

    public static get openWebsocketConnections() {
        return Metrics.websocketOpen;
    }

    public static get websocketMessagesSent() {
        return Metrics.websocketTx;
    }

    public static get websocketMessagesReceived() {
        return Metrics.websocketRx;
    }

    private static config: ConfigMetrics = new ConfigMetrics();

    private static ircConnCount = new Gauge(({
        name: "irc_connection_count",
        help: "Number of active IRC connections",
        labelNames: ["server"],
    }));

    private static ircMsgRx = new Counter(({
        name: "irc_messages_rx",
        help: "Number of IRC messages received",
    }));

    private static ircMsgTx = new Counter(({
        name: "irc_messages_tx",
        help: "Number of IRC messages sent",
    }));

    private static websocketOpen = new Gauge(({
        name: "websocket_connections_open",
        help: "Number of active IRC connections",
    }));

    private static websocketTx = new Counter(({
        name: "websocket_sent",
        help: "Number of messages sent over websocket",
        labelNames: ["host"],
    }));

    private static websocketRx = new Counter(({
        name: "websocket_received",
        help: "Number of messages received over websocket",
        labelNames: ["host"],
    }));

}