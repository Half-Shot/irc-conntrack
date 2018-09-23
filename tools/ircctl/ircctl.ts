import * as Command from "commander";
import * as process from "process";
import {Config} from "../../src/Config";
import * as inquirer from "inquirer";
import * as Ws from "ws";
import {Log} from "../../src/Log";

const log = new Log("");

// @ts-ignore
import inquirer_command_prompt from "inquirer-command-prompt";
import {RequestAPI, RequestResponse} from "request";
import {defaults} from "request-promise-native";
import {StatusCodeError} from "request-promise-native/errors";
import * as os from "os";
import {IWsIrcMessage} from "../../src/WebsocketHandler";
import {IConnectionsResponse, IConnectionState} from "../../src/Rest/IConnectionsResponse";
import {IWsCommand, IWsContentJoinPart, IWsContentSay} from "../../src/WebsocketCommands";

inquirer.registerPrompt("command", inquirer_command_prompt);

const COMMANDS = [
    "help", "list", "connect", "inspect", "filter", "exit", "quit", "use",
    "join", "part", "say", "action", "notice",
];

const listenFilter = {
    server: "",
    id: "",
};

let currentIrcServer: string|null = null;

async function main(urlOrConfig: string, token: string, server?: string) {
    const opts = {
        url: "",
        token: "",
    };
    if (server) {
        currentIrcServer = server;
        log.info(`Using ${currentIrcServer}`);
    }

    if (urlOrConfig && urlOrConfig.startsWith("http")) {
        if (!token) {
            throw new Error("URL provided but token not given");
        }
        opts.url = urlOrConfig;
        opts.token = token;
    } else {
        const config = Config.parseFile(urlOrConfig || "./config.yaml");
        opts.url = `${config.bindAddress}:${config.bindPort}`;
        if (!opts.url.startsWith("http")) {
            opts.url = `http://${opts.url}`;
        }
        opts.token = config.accessToken;
    }

    // Connect
    const URL = `${opts.url}/_irc/ws`;
    const requester = defaults({
        baseUrl: opts.url,
        headers: {
            Authorization: `Bearer ${opts.token}`,
        },
        json: true,
    });
    log.info(`Connecting to ${URL}...`);
    const client = new Ws(URL, "irc-conntrack", {
        headers: {
            Authorization: `Bearer ${opts.token}`,
        },
    });

    client.on("message", (dataStr: string) => {
        let data: IWsIrcMessage;
        try {
            data = JSON.parse(dataStr);
        } catch (e) {
            log.warn("Failed to parse WS message");
            return;
        }

        if (listenFilter.id && data.client_id !== listenFilter.id) {
            return;
        }
        log.info(`New ${data.event} msg from ${data.client_id}:`, data.msg);
    });

    client.once("open", () => {
        log.info("Connected");
        promptForCommand(client, requester);
    });

    client.once("close", (code, reason) => {
        log.error("Connection closed (", code, reason, ")");
        process.exit(1);
    });

    client.once("error", (e) => {
        log.error("Failed to connect ", e);
    });

    client.once("unexpected-response", (req, res) => {
        log.verbose("On upgrade");
    });
}

let shouldContinue = true;
function promptForCommand(client: Ws, request: RequestAPI<any, any, any>): Promise<void> {
    return inquirer.prompt([
        {
            type: "command",
            name: "cmd",
            message: ">",
            validate: isValidCommand,
            // optional
            autoCompletion: COMMANDS,
            context: 0,
            short: false,
        } as any,
    ]).then((cmd: any) => {
        return handleCommand(cmd.cmd.split(" "), client, request);
    }).then(() => {
        if (shouldContinue) {
            return promptForCommand(client, request);
        }
    }).catch((err: Error) => {
        log.error("Error processing command", err);
        if (shouldContinue) {
            return promptForCommand(client, request);
        }
    });
}

function isValidCommand(val: string): boolean {
    const bits = val.split(" ");
    return COMMANDS.includes(bits[0]);
}

async function handleCommand(args: string[], client: Ws, request: RequestAPI<any, any, any>): Promise<void> {
    let clientId = "";
    if (["join", "part", "say", "action", "notice"].includes(args[0])) {
        const c = (await getClientList(request)).find(((id) => id.startsWith(args[1])));
        if (c === undefined) {
            log.warn("No client found with that ID");
            return;
        }
        clientId = c;
        log.info(`Using ${clientId}`);
    }
    switch (args[0]) {
        case "quit":
        case "exit":
            client.close();
            shouldContinue = false;
            break;
        case "list":
            await handleList(args, request);
            break;
        case "filter":
            if (args.length > 1) {
                listenFilter.server = args[1];
            }
            if (args.length > 2) {
                listenFilter.id = args[2];
            }
        case "connect":
            if (args.length < 2) { // nick, realname, username
                log.warn("Missing arg 'server'");
                break;
            }
            request.post(`/_irc/connections/${currentIrcServer}/open`, {
                body: {
                    nicknames: args[1],
                    realname: args[2] || os.userInfo().username,
                    username: args[3] || os.userInfo().username,
                },
            }).then((res: Response) => {
                log.info("New client connected:", res.status, res.body);
            }).catch((err: StatusCodeError) => {
                log.warn("Unexpected error:", err.error);
            });
            break;
        case "join":
        case "part":
            sendWsCommand(client, clientId, args[0],
                {
                    channel: args[2],
                } as IWsContentJoinPart,
            );
            break;
        case "say":
        case "action":
        case "notice":
            sendWsCommand(client, clientId, args[0],
                {
                    target: args[2],
                    text: args[3],
                } as IWsContentSay,
            );
            break;
        case "help":
            log.info("Help text coming soon... :)");
            break;
        case "use":
            currentIrcServer = args[1];
            log.info(`Setting current server to ${currentIrcServer}`);
            break;
        default:
            log.warn("Command not found");
            break;
    }
}

async function getClientList(request: RequestAPI<any, any, any>): Promise<string[]> {
    const res = await request.get(`/_irc/connections/${currentIrcServer}?detail=ids`);
    return (res as IConnectionsResponse).connections as string[];
}

async function handleList(args: string[], request: RequestAPI<any, any, any>) {
    const detail = args[1] === "detailed" ? "state" : "ids";
    let connections: IConnectionState[] | string[];
    try {
        const res = await request.get(`/_irc/connections/${currentIrcServer}?detail=${detail}`);
        connections = (res as IConnectionsResponse).connections;
    } catch (err) {
        if (err.error.errcode === "IC_CLIENT_NOT_FOUND") {
            log.info("No clients are connected to that server");
            return;
        }
        log.warn("Unexpected error:", err.error);
        return;
    }
    if (detail === "state") {
        log.info("UUID | Nick | # Channels");
        (connections as IConnectionState[]).forEach((conn: IConnectionState) => {
            log.info(`${conn.id.substr(0,12)}: ${conn.nick} ${(conn.chans as any).length}`);
        });
    } else {
        log.info((connections as string[]).join(","));
        log.info(`${currentIrcServer} has ${connections.length} connected clients`);
    }
}

async function sendWsCommand(client: Ws, clientId: string, type: string, content: any) {
    client.send(JSON.stringify({
        id: (Math.random() * 1000).toString(),
        client_id: clientId,
        type,
        content,
    }as IWsCommand ));
}

Command
.option("-u --url <url>", "URL of service", undefined)
.option("-t --token <token>", "Access token (if using URL)", undefined)
.option("-s --server <server>", "Server to use by default", undefined)
.option("-config --config <config>", "Config file", undefined);
Command.parse(process.argv);

main(Command.url || Command.config, Command.token, Command.server).catch((e: Error) => {
    log.error("Encountered an error:", e);
});
