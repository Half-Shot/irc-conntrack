import { IMessage } from "../IMessage";

export interface INick extends IMessage {
    newNick: string;
    channels: string[];
}
