# irc-conntrack

[![Build Status](https://travis-ci.org/Half-Shot/irc-conntrack.svg?branch=master)](https://travis-ci.org/Half-Shot/irc-conntrack)

A service to open and manage IRC connections, written in Typescript.

Matrix Room: [#irc-conntrack](https://matrix.to/#/#irc-conntrack:half-shot.uk)

The specification lives in [this Google doc](https://goo.gl/q2HgLA) currently.

## How does it work?

The service is designed to be used with a Matrix appservice, such as [matrix-appservice-irc](https://github.com/matrix-org/matrix-appservice-irc).

A bridge administator would spin up one (or several) instances of this service and configure the configuration file with all the presets needed to connect to an IRC network. Then, they would point the bridge at the service and the bridge would begin to connect all it's users. 

Should the bridge crash at some point, the IRC connections remain intact while the bridge restarts and carrys on as normal. If a configuration update is needed on this service, it can be applied without restarting the service.

And of course, you can shard out as many of these as you like to minimize impact of restarting the service.

## Great, how do I deploy it and start using it on my bridge.

Alas, this project isn't ready to be deployed yet. There is a lot of work involved in breaking in `matrix-appservice-irc` to support remote clients, and this very service isn't quite ready. However, I hope to have some prototypes to show off soon which will eventually lead into production deployments of this service.

You are invited to join the Matrix room for more up to date news on the happenings of this project.

## FAQ

### Why not use a well known S2S (Server to Server) protocol, rather than IRC clients?

Using the S2S protocol in a bridge could work in the future, and something this project would be well suited to covering. However, S2S implies a much greater amount of trust in the bridge hoster, their network and the software itself. IRC clients on the other hand can be tightly controlled and hopefully with the right software (this!), indistinguishable.
