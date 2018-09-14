import { IMessage } from "../IMessage";

export interface IMode extends IMessage {
    adding: boolean;
    /**
     * If this is undefined, this is a channel mode.
     */
    user?: string;
    /**
     * If this is undefined, this is a user mode.
     */
    arg?: string;
    mode: string;
    channel: string;
}
