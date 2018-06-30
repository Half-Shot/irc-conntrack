The high level idea behind irc-conntrack is to seperate IRC connection handling from application logic. The application was written to aid matrix-appservice-irc, but can be used generically with any service. Currently the application is molded to work with one network but can be expanded to multiple.


#### matrix-appservice-irc example

IRC Network <--[Multiple Connections]--> irc-conntrack <--[Single Connection]--> matrix-appservice-irc <--[AS stream]--> synapse
