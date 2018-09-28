---
title: "Unstable"
---

# Unstable specification

{{% notice warning %}}
This is the spec that is in use by bleeding edge implementations that has not been formally baked into a versioned
spec yet.
{{% /notice %}}

## IRC Protocol

This specification does not currently specify a IRC protocol to follow when implementing the spec, and is left as an exercise for the service. It is the responsibility of the client to ensure the implementation they are using is correct for their environment.

## Types

### Client IDs

Client IDs are UUIDs that uniquely identify a IRC client and it's associated TCP connection. It *MUST* not be associated with the client's NICK for longer than the lifetime of the connection, as UUIDs are never reused.

In the API, the key is called `client_id`;
