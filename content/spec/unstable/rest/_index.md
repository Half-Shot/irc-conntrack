---
title: REST
---

## REST Specification Index

The REST API provides a simple way to modify the state
of the connection tracker without having to listen for events over a websocket connection. Generally speaking these operations are done syncronously with the request as oppose to the asyncronous nature of Websockets. For example a call to ``/_irc/connections/$server/open`` will not complete until a connection has been opened or has failed to open.


### Authentication

**All** endpoints require an access token to be used. The access token should be provided in the ``Authorization header`` in the format ``Bearer ACCESS_TOKEN`` but can be specified as a query parameter under the ``access_token`` field.

### Errors

Errors are sent with a standard format of

| Parameter      | Type     | Description |
|----------------|----------|-------------|
| errcode        | `string` | A standard error code given below. |
| irc_reason     | `string` | An optional reason string. |

### Example

```
{
    errcode: “IC_FAILED”,
    irc_reason: “err_banned” (or some other failure error)
}
```


| ERRCODE        | Typical Reason |
|----------------|----------|
| IC_MISSING_PARAM | Parameter(s) were missing from your request. |
| IC_MISSING_TOKEN | You haven't specificed your authentication token. |
| IC_BAD_TOKEN | The authentication token was wrong. |
| IC_NOT_IN_CONFIG | The server you requested was not found in the config. |
| IC_TIMEOUT | The operation timed out |
| IC_FAILURE | Generic failure, check the reason. |
| IC_CLIENT_NOT_FOUND | You tried to do something with a client that wasn't found. |
| IC_CONNECTION_LIMIT | The connection limit for that server has been reached. |
| IC_COMMAND_NOT_RECOGNISED | The websocket command wasn't recognised. |
