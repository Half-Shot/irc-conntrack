import { RestHandler } from "./RestHandler";
import { ConnectionTracker } from "./ConnectionTracker";
import { Config } from "./Config";
import { WebsocketHandler } from "./WebsocketHandler";
import { Log } from "./Log";
import * as Command from "commander";

const log = new Log("main");

function main() {
    Command.option("-c --config", "Config file", undefined, "./config.yaml")
    Command.option("-o --config-option <options>", "Config option", undefined, [])
    .parse(process.argv);

    log.info("Starting irc-conntrack");
    let config: Config;
    try {
        config = Config.parseFile(Command.config || "./config.yaml");
    } catch (e) {
        log.error("Failed to start due to a config error", e);
        throw Error("Exiting due to a bad config");
    }

    log.info("Read config");
    if (Command.configOption) {
        let opts = Array.isArray(Command.configOption) ? Command.configOption : [Command.configOption];
        (opts).forEach((value: string) => {

            const split = value.split("=", 2);
            if (split.length < 2) {
                return;
            }
            config.setOption(split[0].trim(), split[1].trim());
        });
    }
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
