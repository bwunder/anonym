## Autonomous Development and Testing with SQL Server for Linux
Design, construct, reconstruct, simulate or evaluate a network of SQL Server instances.
Six (6) or more SQL Instances - depending on the hardware resources - all running on one
Linux host using Docker Containers and each listening for network query requests on their
own IP at port 1433.

![Image](./docs/catalog.png)

Licensing and Scalability not withstanding, architectural form and function can be accurately 
reproduced with little brain smoke through the well known magic of SQL Server backup/restore,
TSQL scripts and human intelligence. And it all can be easily done today using the Node.js
event loop, the "Official" SQL Server for Linux Docker Images Developer Edition with a couple
of Docker Volumes to facilitate backups/restore and OpenSSL for self-signed TLS security.

Given an ability to properly describe the live environment even SQL Server patch and update
regression evaluations can be quick and easy with low internal resource requirements using
containers. It helps that any collection of SQL Server 2017 versions and/or products (PIDs)
can run side-by-side. Every database backend needed can be on the host for continuity of
productivity when disconnected - not to mention amazingly light performance impact on the host
while everything runs in the background.

Training Databases can might be hosted on a Trainer's laptop. Other collaborations are surely
enabled. All you need are database backups or delimited data files and the TSQL database scripts
that might be necessary for configuration and data obfuscation when necessary.

## Installation

### Install Docker, Node.js, OpenSSL and mssql_tools from package or source

It is recommended that the primary package repo and the CLI package manager for your Linux
OS. e.g., apt-get, rpm, yast, yum, zypper, etc. else local compile from source is used to
complete this step. It may, in some cases, be necessary to get the mssql_tools (was ODBC)
tools from Microsoft's repo. See the Microsoft SQL Server for Linux on-line documentation
for mssql_tools download and installation details.

### Define two docker volumes

Allow Docker to choose the location. Using other paths can result in unexpected access problems
inside the container. This default location also places root access requirements from the host.
These volumes are present in each SQL Server container sqlpal creates as subfolders of '/var/opt/mssql'.

    > docker volume create private
    > docker volume create sqlBackups

### Prepare the application folder

While knowledge of local root credentials is required for full app functionality, running
the Node.js CLI app from a folder location in the current user's $HOME is strongly recommended.
With this practice, multiple people can run a personal app instance and all can use the same
containers as necessary with each having a personal activity history much like *$HOME/.bash_history*
except stored in the client's document database providing far better query & search support.

    > mkdir sqlpal
    > cd sqlpal

Review then clone or copy-paste the project source to this folder from the github repo.

    > https://www.github.com/bwunder/sqlpal

### Create links to the Volumes created above

Certificates are created and self-signed by the host into the private Volume.
SQL Server backups are staged on the sqlBackups volume and can be copied or moved to or
from this location. To enable files to enter from the local network we place a symbolic link
to the volume mointPoint on the host. Obtain the mountPoint path using *docker volume*:

    > docker volume inspect private
    > docker volume inspect sqlBackups

and add a link to that path (here I show my mountPoint, yours could be different)

    > ln -s /var/lib/docker/volumes/private/_data private
    > ln -s /var/lib/docker/volumes/sqlBackups/_data sqlBackups

### Define queries available to the runtime by editing the queries.js module file.

In general, shorter queries that need no modification and expect no parameters are
best suited for embedding as template strings, however, the user is always free to decide what
belongs in queries and what should be a script (we add those below).

Copy and paste any TSQL queries desired and enclose with template string delimiters (`back-ticks`).
Queries are upserted into the 'templates.db' nedb database at each application start-up: all
additions, changes and deletions applied since the last start-up are reported in the log.

### Copy or move the user's TSQL Scripts into the scripts subfolder.

Glenn Barry's "Diagnostic Information Queries" is a good example to answer the question,
"script or query" The individual query expressions are nicely suited for inclusion as queries
however, the script he posts on-line is written atomically. To run as one batch or fail the version test.
In order to reference the splendid notes or execute the atomic behemoth query this probably better
stored as a script. Scripts are available for external access as files. Scripts can be added, changed
or removed from the folder at user will just like any other file.

Scripts must use the *.sql* extension to recognized by the *script* command.

### Review and edit the config.json file as required
  defaults, passwords, paths,

Configuration changes can be made at any time and are applied at the next inline reference - if
that happens - else at the next application start-up as config.json is imported anew.
