# sqlpal
Node.js CLI for Docker Contained SQL Server for Linux CTP

This configuration appears to be suitable for most any 64 bit Linux build with
node.js and Docker installed.

Developed and tested on openSUSE 42.1 Docker (1.13) host running the 'official'
SQL Server for Linux CTP2.0 Docker Image from dockerhub.com. mssql-tools for
CTP2 installed on the host to support sqlpal's sqlcmd and bcp command lines
alternatives with tabular results as well as the mssql NPM package for a odbc
pool of TDS connections with results output as JSON.

No need for a Microsoft Windows platform user interface for set-up,
configuration, administration or troubleshooting during evaluation of the CTP.

mssql: Microsoft SQL
https://github.com/patriksimek/node-mssql

Vantage: "Distributed, realtime CLI for live Node apps"

   "First-class CLI: tab completion, history, you name it.
    Build your own API with the familiar syntax of commander.js.
    SSH-like client / server setup for remote access to your live Node app.
    Production-ready, with authentication middleware and a basic firewall.
    Built-in REPL." - https://github.com/dthree/vantage

Vorpal: "Node's framework for interactive CLIs."

   "Simple, powerful command creation
    Supports optional, required and variadic arguments and options
    Piped commands
    Persistent command history
    Built-in help
    Built-in tabbed auto-completion
    Command-specific auto-completion
    Customizable prompts
    Extensive terminal control
    Custom event listeners' - https://github.com/dthree/vorpal


The 'fs', 'child_process' core modules are Promisified with Bluebird. The
mssql package explicitly uses Bluebird and vantage is built with Bluebird as it's
Promise library.

[docs/cheatsheet.html](docs/cheatsheet.html)
