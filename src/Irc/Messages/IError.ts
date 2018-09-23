import { IMessage } from "../IMessage";

export interface IError extends IMessage {
    target: string;
    error: string;
}
