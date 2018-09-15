import { IMessage } from "../IMessage";

export interface INames extends IMessage {
    users: {[key: string]: Set<string>; };
    channel: string;
}
