import { RestHandler } from "./RestHandler";
import { ConnectionTracker } from "./ConnectionTracker";

function main() {
    const connectionTracker = new ConnectionTracker();
    const rest = new RestHandler(
        connectionTracker,
        9000
    );
    rest.start();
}

main();