# sqlpal
a SQL Server for Linux Vantage CLI

developed and tested from an openSUSE Docker host running the 'official' 
SQL Server for Linux CTP Docker Image (Ubuntu) from dockerhub.com with 
mssql-tools also installed on the host.

The CLI uses the mssql package for database connectivity by default to returns 
results as JSON with command-line options to use your script-files or a user 
redefinable collection of T-SQL queries. 

Details about SQL Server for Linux CTP, including installation at
https://docs.microsoft.com/en-us/sql/linux/

Vantage is a "Distributed, realtime CLI for live Node apps" built containing 
Vorpal: "Node's framework for interactive CLIs. http://vorpal.js.org" 

Vantage claims:  
   "First-class CLI: tab completion, history, you name it.
    Build your own API with the familiar syntax of commander.js.
    SSH-like client / server setup for remote access to your live Node app.
    Production-ready, with authentication middleware and a basic firewall.
    Built-in REPL." - https://github.com/dthree/vantage
    
 Vorpal:
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

cheatsheet.html (saved from user editable cheatsheet.ods) is included with installation, 
configuration and sqlcmd/bcp switch usage with zero dependencies on the Internet or SSMS. 
