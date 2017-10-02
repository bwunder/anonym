# sqlpal
Hack-able Node.js Console for the Docker Contained Microsoft SQL Server for Linux CTP

A stand alone administrative connection (saac, similar to dac) for a locally
hosted Docker image instance (container) for the 'official' SQL Server for Linux
CTP2.0 Docker Image from dockerhub.com.

No need for a browser or a Microsoft Windows OS in the house. User interactions during set-up, configuration, monitoring,
administration or troubleshooting can be done at the command prompt. Command line queries can return JSON via Tedious or tabular results from SQLCMD, but if you have a V8 powered browser, that works too and the query results are nicely formatted tabular data on the web page.

Define local subnet IPv4 firewall rules to maintain well controlled network command-line access to the SQL Server Instance.

    (./docs/cheatsheet.html) for some cribs when not connected to the Internet.
    (./docs/post.ods) may become an app tutorial some day.
    (./history/) is a JSON record of Batches sent to SQL Server from the sqlpal command-line.
    (./scripts/) is a folder for user defined T-SQL scripts available at the sqlpal command-line.
    (./data/) contains a pre-populated nedb for the embedded sqlpad server and a queries object.
    (commands.js) the CLI app
    (config.json)
    (lib.js)
    (LICENSE)
    (package.json)
    (queries.js) is a JSON collection of named javascript template strings   
    (README.md) is this file

Chromium or Google Chrome browser required for sqlpad
