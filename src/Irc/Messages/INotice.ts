import { IMessage } from "../IMessage";

export interface INotice extends IMessage {
    from: string;
    to: string;
    text: string;
    isCTCP: boolean;
}
