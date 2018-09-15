import { IMessage } from "../IMessage";

export interface ITopic extends IMessage {
    channel: string;
    topic: string;
    /**
     * Not *always* === nick apparently.
     */
    topicBy: string;
}
