export interface IErrorResponse {
    errcode: string;
    error: string;
}

export const ERRCODES = {
    missingParameter: "IC_MISSING_PARAM",
    missingToken: "IC_MISSING_TOKEN",
    badToken: "IC_BAD_TOKEN",
    notInConfig: "IC_NOT_IN_CONFIG",
    timeout: "IC_TIMEOUT",
    genericFail: "IC_FAILURE",
    clientNotFound: "IC_CLIENT_NOT_FOUND",
    connectionLimit: "IC_CONNECTION_LIMIT",
};
