## Autonomous Development and Testing with SQL Server on Linux
Design, construct, reconstruct, simulate, evaluate a network of SQL Server instances.
Six (6) or more SQL Instances on i5-8GB laptop - depending on the hardware resources - on
Linux host using Docker Containers and each listening for network query requests on their
own IP at port 1433 while simultaneously connected to the host at local app assigned ports.

![Image](./docs/catalog.png)

Licensing and Scalability not withstanding, architectural form and function can be accurately
reproduced with little brain smoke through the well known magic of SQL Server backup/restore,
TSQL scripts and a one page diagram/plan. Here the Node.js event loop is used along with the
"Official" SQL Server on Linux Docker Images Developer Edition and a couple of Docker Volumes
to facilitate backups/restore and OpenSSL credential sharing for an autonomous self-signed
TLS security profile: the credentials are not available outside the uncompromised host.

Given an ability to properly describe the live environment even SQL Server patch and update
regression evaluations can be quick and easy with low internal resource requirements using
containers. It helps that any collection of SQL Server 2017 versions and/or products (PIDs)
can run side-by-side in this model. Every database backend needed can be on the host for
continuity of productivity when disconnected - not to mention amazingly light performance
impact on the host while everything runs in the background.

Training Databases can might be hosted on a Trainer's laptop. Other collaborations are surely
enabled. All you need are database backups or delimited data files and the TSQL database scripts
that might be necessary for configuration and data obfuscation when necessary.

## Installation

### 1. Prerequisites
    Docker, 
    Node.js, 
    OpenSSL, 
    mssql_tools (a.k.a., sqlcmd and bcp), 
    IDE (i.e., Atom or VSCode )  

Try first to source prereqs in the primary package repo(s) for your Linux 
distro using the included package manager else compile from source to 
complete this step. 

The mssql_tools are on Microsoft's SQL Server on Linux support site. This 
is a different download than the SQL Server Data Tools (SSDT). See Microsoft's SQL 
Server on Linux Installation page on-line for more details. 

### 2. Init
#### Prepare and enter a new folder

While ocassional elevation to local admin credentials is required for full 
app functionality, running the Node.js CLI app from a folder in the current 
user's $HOME is strongly recommended.
Following this practice, multiple people can run a personal app instance and 
all can share the SQL Server Containers. Each user will generate a personal 
activity history stored in a personal nedb document database.

    > mkdir sqlpal
    > cd sqlpal

#### move the reviewed source from the sqlpal github project into this folder

    > https://www.github.com/bwunder/sqlpal

#### Define queries available to the runtime by editing the queries.js module file.

In general, shorter queries that need no modification and expect no parameters are
best suited for the query-store, but the user is free to decide what belongs in the 
query-store and what would better be in a script (we add those below). Scripts have 
the decided advantage of being accessible and usable from other tools. Queries have 
the decided advantage of being private and - if warranted - obfuscated when at rest.

    Queries.js is upserted on demand (query --import)
Additions, changes and deletions to the queries.js file serialization applied since 
the last start-up are reported to stdout as the changes are moved into the query-store.
Changes are in effect with the next query after the query is imported.

###Copy or move TSQL Scripts into the scripts subfolder.

Individual query expressions are nicely for inclusion in templates.db. Scripts with more than one
query are probably better stored as script files. Scripts can be added, changed or removed from the
folder at any time like any other file or from the sqlpal CLI (**script <file-name> --edit**). Changes
take effect immediately beginning with the next script execution after the save.

Only Scripts using the *.sql* extension are recognized by the **script** command. Scripts can be added,
edited or removed at any time. Changes will be immediately reflected by the CLI.  

#### (recommended but optional) Review and edit the config.json and openssl.cnf files as appropriate

Settings in config.json, other than perhaps passwords, will usually get you started with no changes.
Many are simply the defaults used when a setting is not explicitly set.

App Configuration changes can be made at any time and are applied at the next runtime reference - if
that happens - else at the next application start-up as config.json is imported anew.

openssl.cnf settings changes to not change any existing artifacts, the .cnf can be changed t any time
__before__ a credential is generated.

see [sqlpad config documentation](https://github.com/rickbergfalk/sqlpad/blob/master/server/lib/config/configItems.js)
for details on sqlpad configuration. Note that sqlpad is used as a dependent process. It is
not necessary to also install a global instance. You can if wish, however the global instance
will not use configuration values from config.json. (There will likely be another 'sqlpaddata'
folder elsewhere on the machine shared among users of the global instance.  The sqlpal configured
sqlpad.dir will be private to the dependency (caution: collisions when the same fully qualified path  
is used may be possible - I have not adequately tested this.)

### 3. Run the CLI

    > npm update
    > npm start
