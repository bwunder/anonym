# sqlpal
Javascript Console for Microsoft SQL Server for Linux Docker Containers

A stand alone administrative SQL Server connection (SAAC) to an 'official' locally
hosted SQL Server for Linux in a Container Instance from https://www.dockerhub.com.

No remote client dependencies. Useful for interacting with the SQL Server Query
Engine during not only development, but for set-up, configuration, monitoring,
administration or troubleshooting as well.

Supports many SQL Server's on a development workstation. As a demonstrated example,
six (6) SQL Server Instances can run at the same time on a typical 5i CPU/8GB RAM laptop.

Succinct CLI command selection to quickly and administer, develop or
test SQL Server for Linux Containers on a Linux platform.

Includes a browser option to launch SQLPad for Chromium/Chrome

Blinking cursor & Browser options:

    Command line

        * Monitor and manage the Local SQL Server for Linux Docker infratructure
        * Run ad hoc queries, script files or pick one from the client query store
        * Query via Tedious.js (e.g., Javascript Toasted Data Streams) to render JSON
        * Query via the SQL Server for Linux ODBC port and SQLCMD to get tabular results

    Chromium (or Chrome) Browser

        * [SQLPad](https://www.npmjs.com/package/sqlpad)  
            * Graphical Query tool with tabular results in HTML
            * Charts
            * Connect directly to Container IP port (e.g., 1433) or through  a run-time port map
            * Query Postgres, MySQL, Crate, Vertica and other SQL Server databases
