// irc-colors has no typings yet.
// tslint:disable-next-line:no-var-requires
const ircColors = require("irc-colors");
import {Codes} from "./IrcCodes";
import { Log } from "../Log";

const log = new Log("IMessage");

export interface IMessage {
    prefix?: string;
    nick?: string;
    user?: string;
    host?: string;
    command?: string;
    commandType?: string;
    rawCommand?: string;
    rawLine?: string;
    server?: string;
    args: string[];
    tags?: {[key: string]: string };
    badFormat: boolean;
}

/**
 * parseMessage(line, stripColors)
 *
 * takes a raw "line" from the IRC server and turns it into an object with
 * useful keys
 * @param {String} line Raw message from IRC server.
 * @param {Boolean} stripColors If true, strip IRC colors.
 * @return {Object} A parsed message object.
 */
export function parseMessage(line: string, stripColors: boolean = true): IMessage {
    const I_NICK = 1;
    const I_USER = 3;
    const I_HOST = 4;
    const message: IMessage = {
        args: [],
        rawLine: line,
        badFormat: false,
    };
    let match;

    if (stripColors) {
        line = ircColors.stripColorsAndStyle(line);
    }

    const LINE_REGEX = /^(@(\w+\=[^; ]*;?)* )?:([^ ]+) +/;
    match = line.match(LINE_REGEX);
    if (match) {
        // https://ircv3.net/specs/extensions/message-tags
        if (match[1]) {
            message.tags = parseTags(match[1]);
        }
        message.prefix = match[3];
        line = line.replace(LINE_REGEX, "");
        match = message.prefix.match(/^([_a-zA-Z0-9\[\]\\`^{}|-]*)(!([^@]+)@(.*))?$/);
        if (match) {
            message.nick = match[I_NICK];
            message.user = match[I_USER];
            message.host = match[I_HOST];
        } else {
            message.server = message.prefix;
        }
    }

    // Parse command
    match = line.match(/^([^ ]+) */);
    if (match === null) {
        message.badFormat = true;
        log.error("Message was not in an understood format");
        return message;
    }
    message.command = match[1];
    message.rawCommand = match[1];
    message.commandType = "normal";
    line = line.replace(/^[^ ]+ +/, "");

    if (Codes[message.rawCommand]) {
        message.command     = Codes[message.rawCommand].name;
        message.commandType = Codes[message.rawCommand].type;
    }

    message.args = [];
    let middle: string;
    let trailing: string|null = null;

    // Parse parameters
    if (line.search(/^:|\s+:/) !== -1) {
        match = line.match(/(.*?)(?:^:|\s+:)(.*)/);
        if (match === null) {
            message.badFormat = true;
            log.error("Message was not in an understood format");
            return message;
        }
        middle = match[1].trimRight();
        trailing = match[2];
    } else {
        middle = line;
    }

    if (middle.length) {
        message.args = middle.split(/ +/);
    }

    if (trailing !== null && trailing.length) {
        message.args.push(trailing);
    }

    return message;
}

function parseTags(tagString: string): {[key: string]: string} {
    const map: {[key: string]: string} = {};
    tagString = tagString.substr(1, tagString.length - 2); // Remove the @ and final space
    tagString.split(";").forEach((tag) => {
        const parts = tag.split("=");
        map[parts[0]] = parts[1];
    });
    return map;
}
