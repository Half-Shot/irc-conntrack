import { IMessage } from "../IMessage";

export interface IJoin extends IMessage {
    channel: string;
}
