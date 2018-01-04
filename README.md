# sqlpal
Hack-able Node.js Console for the Docker Contained Microsoft SQL Server for Linux

A stand alone administrative connection (SAAC, conceptually similar to a DAC) for a
locally hosted Docker image instance (container) for the 'official' SQL Server for
Linux Docker Image from https://www.dockerhub.com.

No Windows OS client dependency. User interactions during set-up, configuration, monitoring,
administration or troubleshooting can be done at the command prompt. Command line queries can return JSON via Tedious.js or tabular results through SQLCMD, but if you have a V8 powered browser, that can work too, with nicely formatted tabular query results on a web page or the results can be charted when appropriate.

Protected LAN access to the SQL Server Instance.

    non-public https ports
    Local subnet Vantage "simple" IPv4 firewall,
    SSL sqlpad web and remote Vantage command prompt access,
    Javascript encryption, hashing and signing
    Client hosted query store


    (./docs/cheatsheet.html) for some cribs when not connected to the Internet.
    (./docs/post.ods) may become an app tutorial some day. just garbage at the moment
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
