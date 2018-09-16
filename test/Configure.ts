import { Log } from "../src/Log";
import { argv } from "process";

if (!argv.includes("--logging")) {
    Log.ForceSilent();
}
