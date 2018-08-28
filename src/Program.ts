import { RestHandler } from "./RestHandler";
import { ConnectionTracker } from "./ConnectionTracker";
import { Config } from "./Config";
import { WebsocketHandler } from "./WebsocketHandler";
import { Log } from "./Log";

const log = new Log("main");

function main() {
    log.info("Starting IrcConntrack")
    const config = new Config();
    log.info("Read config");
    const websocketHandler = new WebsocketHandler(
        config,
    );
    const connectionTracker = new ConnectionTracker(
        config,
        websocketHandler,
    );
    const rest = new RestHandler(
        connectionTracker,
        websocketHandler,
        config,
    );
    log.info("Starting rest handler");
    rest.configure();
    rest.listen();
}

main();