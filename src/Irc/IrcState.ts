export interface IChannelListItem {
    name: string;
    users: string;
    topic: string;
}

export interface IChannel {
    key: string;
    serverName: string;
    users: {[key: string]: Set<string>; };
    mode: Set<string>;
    created?: string;
    topic?: string;
    topicBy?: string;
}

/**
 * This class is used to hold state set by the MessageParser to be used by the client
 * ensuring that neither have to depend on each other.
 *
 * In the future this will be modelled to deduplicate information between clients.
 */
export class IrcState {
    public motd: string;
    public channelList: IChannelListItem[];
    public nick?: string;
    public whoisData: Map<string, any>;
    public usermode?: string;
    public maxLineLength: number;
    public hostMask: string;
    /**
     * This is the nick requested by us to the server. If the server rejects it, we should
     * set this to something else.
     */
    public requestedNickname: string;
    public chans: Map<string, IChannel>;

    constructor() {
        this.motd = "";
        this.channelList = [];
        this.whoisData = new Map();
        this.maxLineLength = 0;
        this.hostMask = "";
        this.requestedNickname = "";
        this.chans = new Map();
    }

    public setWhoisData(nick: string, key: string, value: string|string[], ifExists: boolean= false) {
        if (ifExists && !this.whoisData.has(nick)) {
            return;
        }
        const whois = this.whoisData.get(nick) || {};
        whois[key] = value;
        this.whoisData.set(nick, whois);
    }

    public appendMotd(text: string, clear: boolean = false, finished: boolean = false) {
        if (clear) {
            this.motd = "";
        }
        this.motd += text;
    }

    public updateMaxLineLength() {
        const LENGTH_TOTAL = 510;
        const MAXIMUM_LINE_LENGTH = LENGTH_TOTAL - ":!PRIVMSG:".length;
        // target is determined in _speak() and subtracted there
        const NICK_LEN = this.nick ? this.nick.length : 0;
        this.maxLineLength = MAXIMUM_LINE_LENGTH - NICK_LEN - this.hostMask.length;
    }

    public chanData(name: string, create: boolean = false): IChannel|undefined {
        const key = name.toLowerCase();
        if (!this.chans.has(key)) {
            if (!create) {
                return;
            }
            this.chans.set(key, {
                key,
                serverName: name,
                users: {},
                mode: new Set(),
            });
        }
        return this.chans.get(key);
    }
}
