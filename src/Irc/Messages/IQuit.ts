import { IMessage } from "../IMessage";

/**
 * *Note*: Also used for KILL.
 */
export interface IQuit extends IMessage {
    channels: string[];
    reason: string;
}
