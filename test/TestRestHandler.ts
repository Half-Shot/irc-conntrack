import { expect } from "chai";
import { RestHandler } from "../src/RestHandler";

describe("RestHandler", () => {
   describe("constructor", () => {
      it("should construct", () => {
         const c = new RestHandler({} as any, 5);
      });
   });
});
