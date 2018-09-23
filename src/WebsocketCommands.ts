export interface IWsCommand {
    client_id: string;
    id: string;
    type: string; // ["raw","join"]
    content: string|IWsContentJoinPart|IWsContentSay;
}

export interface IWsContentJoinPart {
    channel: string;
}

export interface IWsContentSay {
    target: string;
    text: string;
}
