# ircctl

A tool to inspect and control IRC connections within the service.

### How to use

* Build the project.
* Start using `npm run ircctl -- -u URL -t SECRET`
  * Alternatively, use `npm run ircctl -- -c configfile`
  * Even better, it will automatically use `config.json` if you specify nothing.
* Make sure to specify which server (in the config)
you want to be poking with ``use servername``.

### Notes

* The tool will close if it is disconnected from the service.
* You can mute the messages coming from clients by typing `filter off`. You can also filter for one specific client by typing `filter THEID`.
* Type `help` for a list of commands.
