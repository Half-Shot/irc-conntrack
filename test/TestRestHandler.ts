import { expect } from "chai";
import { RestHandler } from "../src/RestHandler";
import * as Mock from 'mock-require';

let callbacks = {} as any;

Mock('express', () => {
    return {
        get: (params: string, cb: Function) => {
            callbacks["get:"+params] = cb;
        },
        post: (params: string, cb: Function) => {
            callbacks["post:"+params] = cb;
        },
        listen: (port: number) => {

        }
    }
});
   

describe("RestHandler", () => {
   describe("constructor", () => {
      it("should construct", () => {
         const c = new RestHandler({} as any, {} as any, {} as any);
      });
   });
   describe("start", () => {
    it("should setup all handers", () => {
       const c = new RestHandler({} as any, {} as any, {} as any);
       c.start();
       console.log(callbacks);
       expect(Object.keys(callbacks)).to.have.lengthOf(6);
    });
 });
});
