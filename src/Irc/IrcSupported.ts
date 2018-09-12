export interface IIrcSupported {
    casemapping: string;
    usermodes: string;
}

export function getDefaultSupported(): IIrcSupported {
    return {
        casemapping: "",
        usermodes: "",
    };
}
