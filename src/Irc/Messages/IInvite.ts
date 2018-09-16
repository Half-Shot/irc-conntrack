import { IMessage } from "../IMessage";

/**
 * *NOTE*: 'nick' is the sender
 */
export interface IInvite extends IMessage {
    to: string;
    channel: string;
}
