---
title: "/_irc/connections"
---

## GET ``/_irc/connections/$server``

This endpoint will fetch all connections for a given server. This should be called on appservice startup and during outages.
The output varies by what ``detail`` is set to. A state list will return the same as fetching the connection state, except
it will fetch for all connections whereas list will just fetch the list of connections that are open.

Closed connections will not be included in the list and clients are encouraged to use the websocket connection to catch these.

### Request format

| Parameter | Type   | Description |
|-----------|--------|-------------|
| server    | `string` | The irc server (e.g. irc.freenode.net) |
| detail    | `string` | The level of detail to respond with. One of [“state”, “ids”]. Defaults to “state” |

### Response format

#### detail == "state"

| Parameter      | Type     | Description |
|----------------|----------|-------------|
| connections    | [ConnectionState]({{< ref "#connectionstate" >}})[] | A list of state for each connection.

#### detail == "ids"

| Parameter      | Type     | Description |
|----------------|----------|-------------|
| connections    | string[] | A list of [client_ids]({{< ref "/spec/unstable/_index.md#client-ids" >}}) |


## GET ``/_irc/connections/$server/$id``

Get the state of a given connection. Both unknown ids and closed connections will respond with a 404.

| Parameter | Type   | Description |
|-----------|--------|-------------|
| server    | `string` | The irc server (e.g. irc.freenode.net) |
| id    | `string` | The [client_id]({{< ref "/spec/unstable/_index.md#client-ids" >}}) |

### Response format

See [ConnectionState]({{< ref "#connectionstate" >}})

## Types

### ConnectionState

| Parameter      | Type     | Description |
|----------------|----------|-------------|
| ...    | ... | ... |
