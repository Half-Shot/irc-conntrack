import { IMessage } from "../IMessage";

/**
 * This also is used for PRIVMSG, which takes the same values.
 */
export interface INotice extends IMessage {
    from: string;
    to: string;
    text: string;
    isCTCP: boolean;
}
