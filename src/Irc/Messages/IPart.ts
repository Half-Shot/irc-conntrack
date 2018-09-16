import { IMessage } from "../IMessage";

export interface IPart extends IMessage {
    channel: string;
    reason: string;
}
