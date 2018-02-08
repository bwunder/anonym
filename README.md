# sqlpal
Javascript Console for Microsoft SQL Server for Linux Docker Containers

A stand alone administrative SQL Server connection (SAAC) to an 'official' locally
hosted SQL Server for Linux Instance from https://www.dockerhub.com.

No remote client dependencies. Useful for interacting with the SQL Server Query
Engine during not only development, but for set-up, configuration, monitoring,
administration or troubleshooting as well.

Provides a focused tool set and aids to help the knowledgable SQL Server person
quickly and easily navigate SQL Server for Linux Containers in a Linux environment.  

Blinking cursor & Browser options:

    Command line

        * Monitor and manage the Local SQL Server for Linux Docker infratructure
        * Run ad hoc queries, script files or pick one from the client query store
        * Query via Tedious.js (e.g., Javascript Toasted Data Streams) to render JSON
        * Query via the SQL Server for Linux ODBC port and SQLCMD to get tabular results

    Chromium (or Chrome) Browser

        * [SQLPad](https://www.npmjs.com/package/sqlpad)  
            * Graphical Query tool
            * Charts
            * Connect directly to Container IP port 1433 or through Host port map
