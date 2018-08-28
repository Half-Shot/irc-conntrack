import { expect } from "chai";
import * as Mock from 'mock-require';

let callbacks = {} as any;
let useFunctions: any[] = [];

const expressMock = (() => {
    return {
        get: (params: string, cb: Function) => {
            callbacks["get:"+params] = cb;
        },
        post: (params: string, cb: Function) => {
            callbacks["post:"+params] = cb;
        },
        ws: (params: string, cb: Function) => {
            callbacks["ws:"+params] = cb;
        },
        listen: (port: number) => {

        },
        use: (fn: Function) => {
            useFunctions.push(fn);
        }
    }
}) as any;

expressMock.json = () => {}

Mock('express', expressMock);

Mock('express-ws', (app) => {
    return {
        app
    };
});

import { RestHandler } from "../src/RestHandler";
import { fail } from "assert";
import { ERRCODES, IErrorResponse } from "../src/Rest/ErrorResponse";

describe("RestHandler", () => {
   beforeEach(() => {
        callbacks = {};
        useFunctions = [];
   });
   describe("constructor", () => {
      it("should construct", () => {
        const c = new RestHandler({} as any, {} as any, {} as any);
      });
   });
   describe("configure", () => {
    it("should setup all handers", () => {
        const c = new RestHandler({} as any, {} as any, {} as any);
        c.configure();
        expect(Object.keys(callbacks)).to.have.lengthOf(7);
    });
   });
   describe("checkToken", () => {
       let c: RestHandler;
    beforeEach(() => {
        c = new RestHandler({} as any, {} as any, {
            accessToken: "ValidToken"
        } as any);
        c.configure();
    });
    it("should accept token from header", () => {
        return new Promise((resolve, reject) => {
            return useFunctions[2]({
                header: (headerName: string) => {
                    expect(headerName).is.eq("Authorization");
                    return "Bearer ValidToken";
                }
            },{
                send: reject,
            }, () => {resolve()});
        });
    });
    it("should accept token from parameter", () => {
        return new Promise((resolve, reject) => {
            return useFunctions[2]({
                header: (headerName: string) => {
                    return undefined;
                },
                query: {
                    "access_token": "ValidToken"
                }
            },{
                send: reject,
            }, () => {resolve()});
        });
    });
    it("should not accept token if it is wrong, via header", () => {
        return new Promise((resolve, reject) => {
            return useFunctions[2]({
                header: (headerName: string) => {
                    expect(headerName).is.eq("Authorization");
                    return "BadToken";
                }
            },{
                send: resolve,
            }, () => {reject()})
        }).then((res: any) => {
            expect(res.errcode).to.eq(ERRCODES.badToken);
        });
    });
    it("should not accept token if it is wrong, via query", () => {
        return new Promise((resolve, reject) => {
            return useFunctions[2]({
                header: (headerName: string) => {
                    return undefined;
                },
                query: {
                    "access_token": "BadToken"
                }
            },{
                send: resolve,
            }, () => {reject()})
        }).then((res: any) => {
            expect(res.errcode).to.eq(ERRCODES.badToken);
        });
    });

    it("should not accept if token is not given", () => {
        return new Promise((resolve, reject) => {
            return useFunctions[2]({
                header: (headerName: string) => {
                    return undefined;
                },
                query: {

                }
            },{
                send: resolve,
            }, () => {reject()})
        }).then((res: any) => {
            expect(res.errcode).to.eq(ERRCODES.missingToken);
        });
    });
   });
});
