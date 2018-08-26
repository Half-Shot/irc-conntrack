export interface IErrorResponse {
    errcode: String,
    error: String,
};

export const ERRCODES = {
    missingParameter: "IC_MISSING_PARAM",
    missingToken: "IC_MISSING_TOKEN",
    badToken: "IC_BAD_TOKEN",
};