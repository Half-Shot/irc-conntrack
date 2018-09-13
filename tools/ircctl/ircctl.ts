import * as Command from "commander";
import * as process from "process";
import {Config} from "../../src/Config";
import * as inquirer from "inquirer";
import * as Ws from "ws";

inquirer.registerPrompt('command', require('inquirer-command-prompt'));

const COMMANDS = ["help", "list", "inspect", "listen", "exit"];

async function main(url_or_config: string, token: string) {
    let opts = {
        url: "",
        token: "",
    };

    if (url_or_config.startsWith("http")) {
        if (!token) {
            throw new Error("URL provided but token not given");
        }
        opts.url = url_or_config;
        opts.token = token;
    } else {
        const config = Config.parseFile(url_or_config || "./config.yaml");
        opts.url = `${config.bindAddress}:${config.bindPort}`;
        if (!opts.url.startsWith("http")) {
            opts.url = `http://${opts.url}`;
        }
        opts.token = config.accessToken;
    }

    // Connect
    const URL = `${opts.url}/_irc/ws`;
    console.log(`Connecting to ${URL}...`);
    const client = new Ws(opts.url, {
        headers: {
            "Authorization": `Bearer ${opts.token}`
        }
    });

    client.once("open", () => {
        console.log("Connected");
        promptForCommand();
    });

    client.once("error", (e) => {
        console.error("Failed to connect", e);
    });
}

let shouldContinue = true;
function promptForCommand(): Promise<void> {
    return inquirer.prompt([
        {
            type: 'command',
            name: 'cmd',
            message: '>',
            validate: isValidCommand,
            // optional
            autoCompletion: COMMANDS,
            context: 0,
            short: false
        } as any
    ]).then((cmd: any) => {
        return handleCommand(cmd.cmd.split(" "));
    }).then(() => {
        if (shouldContinue) {
            return promptForCommand();
        }
    }).catch((err: Error) => {
        console.error("Error occured processing command", err);
        if (shouldContinue) {
            return promptForCommand();
        }
    });
}

function isValidCommand(val: string): boolean {
    const bits = val.split(" ");
    return COMMANDS.includes(bits[0]);
}

async function handleCommand(args: string[]): Promise<void> {
    if (args[0] === "exit") {
        shouldContinue = false;
    }
    if (args[0] === "help") {
        console.log("Help text coming soon... :)");
    }
}

Command
.option("-u --url <url>", "URL of service", undefined)
.option("-t --token <token>", "Access token (if using URL)", undefined)
.option("-config --config <config>", "Config file", undefined);
Command.parse(process.argv);

main(Command.url || Command.config, Command.token).catch((e: Error) => {
    console.error("Encountered an error:", e)
});
