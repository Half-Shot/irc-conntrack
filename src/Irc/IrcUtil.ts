import { IIrcSupported } from "./IrcSupported";
import { IMessage } from "./IMessage";

// Reference: http://www.irc.org/tech_docs/005.html
const KNOWN_CASE_MAPPINGS = ["ascii", "rfc1459", "strict-rfc1459"];

export class IrcUtil {
    public static convertEncoding(buffer: Buffer, encoding: Boolean): Buffer {
        const out = buffer;
        // TODO: Fix this
        // try {
        //     var charsetDetector = require('node-icu-charset-detector');
        //     var Iconv = require('iconv').Iconv;
        //     var charset = charsetDetector.detectCharset(str);
        //     var converter = new Iconv(charset.toString(), encoding);

        //     out = converter.convert(str);
        // } catch (err) {
        //     if (self.opt.debug) {
        //         util.log('\u001b[01;31mERROR: ' + err + '\u001b[0m');
        //         util.inspect({ str: str, charset: charset });
        //     }
        // }
        return out;
    }

    // Checks the arg at the given index for a channel. If one exists, casemap it
    // according to ISUPPORT rules.
    public static casemap(msg: IMessage, index: number, supported: IIrcSupported): void {
        if (!msg.args || !msg.args[index] || msg.args[index][0] !== "#") {
            return;
        }
        msg.args[index] = IrcUtil.toLowerCase(msg.args[index], supported);
    }

    public static toLowerCase = function(str: string, supported: IIrcSupported) {
        if (KNOWN_CASE_MAPPINGS.indexOf(supported.casemapping) === -1) {
            return str;
        }
        let lower = str.toLowerCase();
        if (supported.casemapping === "rfc1459") {
            lower = lower.
            replace(/\[/g, "{").
            replace(/\]/g, "}").
            replace(/\\/g, "|").
            replace(/\^/g, "~");
        } else if (supported.casemapping === "strict-rfc1459") {
            lower = lower.
            replace(/\[/g, "{").
            replace(/\]/g, "}").
            replace(/\\/g, "|");
        }
        return lower;
    };
}
