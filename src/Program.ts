import { RestHandler } from "./RestHandler";
import { ConnectionTracker } from "./ConnectionTracker";
import { ICConfig } from "./Config";
import { WebsocketHandler } from "./WebsocketHandler";

function main() {
    const config = new ICConfig();
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
    rest.start();
}

main();