export interface IIrcSupported {
    casemapping: string;
    usermodes: string;
    channel: IChannelLimits;
    kicklength: number;
    maxlist: {[mode: string]: number; };
    maxtargets: {[mode: string]: number; };
    modes: number;
    nicklength: number;
    topiclength: number;
    usermodepriority: string;
    modeForPrefix: {[prefix: string]: string; };
    prefixForMode: {[mode: string]: string; };
}

interface IChannelLimits {
    idlength: {[mode: string]: string; };
    length: number;
    limit: {[prefix: string]: number; };
    modes: {[mode: string]: string; };
    types: string;
}

export function getDefaultSupported(): IIrcSupported {
    return {
        channel: {
            idlength: {},
            length: 200,
            limit: {},
            modes: { a: "", b: "", c: "", d: ""},
            types: "", // TODO: self.opt.channelPrefixes
        },
        kicklength: 0,
        maxlist: {},
        maxtargets: {},
        modes: 3,
        nicklength: 9,
        topiclength: 0,
        usermodes: "",
        usermodepriority: "", // E.g "ov"
        casemapping: "ascii",
        modeForPrefix: {},
        prefixForMode: {},
    };
}
