# Anonym 
### Lifecycle Automation and CI Tools for hosted SQL Server Containers 

Architect, Develop, Test & otherwise evaluate Private & Autonomous Virtual Data Topologies   

    * Manage and secure the Docker Container Engine systemd daemon (dockerd)
    * Source and deploy Official SQL Server Docker Images from https://dockerhub.com
    * Create and use as many Contained SQL Server for Linux instances as needed 
    * Emulate distributed or cloud data apps on one local compute instance
    * Comingle any assortment of SQL and NoSQL data stores
    * Edit and reuse CLI stored scripts and queries targeting the anonym's data stores

![Image](./docs/catalog.png)

    Anonym came into existence as a Linux CLI for SQL Server in the days after the SQL Server CTP on Linux but before there were friendly tools to make SQL Server for Linux very interesting without a Windows client, so the data store supported was SQL Server for Linux. The anonym can help create and provision SQL Server Instances. Dockerhub, however, carries offical images for every data storage engine that has gained some measure of popularity - and some we still know nothing about. And NPM almost certainly exposes a Javascript query driver for any NoSQL data store that hopes to gaine mainstream acceptance. Given those componets, the anonym framework can be trained to support any data store.

    ###SQL Server

    Every SQL Server gets an IP address where it listens on the docker bridge network and a port where it listens on the compute instance. The anonym tracks and reuses IP and port assignments and encrypts sensitive data when not in use. 
    
    Any assortment of SQL Server 2017 versions and/or products (PIDs) can run side-by-side. Every database backend needed can be on the host for continuity of productivity when disconnected. When everything idles along in the background, the destop is unlikely to suffer a performance degradation, yet there could well be normalized and indexed SQL Server data active and available and in use locally.

    Many Scenaios in addition to classic Designand development are enabled. A number of Training Databases, for example, might be hosted on a Trainer's laptop. All that might be required is one database backup that can be reused repeatedly by all else one set of data files and/or scripts needed to set-up the initial data state across every instance. Or   

## Installation

### 1. Prerequisites

    * Docker version 17+ 
    * Node.js version 8+  
    * OpenSSL version 1.1+
    * An IDE for Linux that knows if passed text is javascript or TSQL (i.e., atom, bluefish, code, etc.)
    * (nice-to-have) text editor able to read-write app buffers - in event vim is too arcane. (GNU EMACS is nice)
    * (nice-to-have) mssql_tools (The anonym uses only the mssql_tools already included in the SQL Server Containers)
    * (nice-to-have) "Official" Docker Containers for any NoSQL needed 

    Docker, node and OpenSSL are available through the main command-line package managers of most Linux Distro's 
    and may alrady be up and running on the local machine.  

    EMACS is a fabulous alternative to vi (vim). Possibly, a reed and clay tables are an much an improvement? Best thing about vi is its ubiquity on Linux.

    The mssql_tools can be sourced from Microsoft's SQL Server on Linux web pages. 
    The CLI relies only on sqlcmd from the mssql_tools already included in each container 


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

#### Initialize the query store 

    Start by importing the shipped queries. You could also add your favorites to the 
    queries.js module file before the first import or add them as you go. 

    In general, queries that need no modification and expect no parameters are
    well suited for the query-store, but the user is free to decide what belongs in the 
    query-store and what would better be in a script (we add those below). Scripts have 
    the decided advantage of being accessible and usable from other tools. Queries have 
    the decided advantage of being private and - if warranted - obfuscated when at rest.

    "lib/Queries.js" is upserted on demand (**query import**)
    Additions, changes and deletions to the queries.js file serialization applied since 
    the last start-up are reported to stdout as the changes are moved into the query-store.
    All changes are effective with the next query after the import.

###Copy or move TSQL Scripts into the scripts subfolder.

    Individual query expressions of a few lins are better inclused in templates.db. Scripts with more than one
    query are probably better stored as script files. Scripts can be added, changed or removed from the
    folder at any time like any other file or from the sqlpal CLI (**script <file-name> --edit**). Changes
    take effect immediately beginning with the next script execution after the save.

    Only Scripts using the *.sql* extension are recognized by the **script** command. Scripts can be added,
    edited or removed at any time. Changes will be immediately reflected by the CLI.  

#### (recommended but optional) Review and edit the config.json and openssl.cnf files as appropriate

Settings in config.json, other than perhaps passwords, will usually get you started with no changes.
Most are the defaults used when a setting is not explicitly set: exposed in the config for tweakers.

App Configuration changes can be made at any time and are applied at the next runtime reference - if
that happens - else at the next application start-up as config.json is imported anew.

openssl.cnf settings changes to not change any existing artifacts, the .cnf can be changed any time,
but it won't do much good to change it __after__ the top level credential is generated.

see [sqlpad config document](https://github.com/rickbergfalk/sqlpad/blob/master/server/lib/config/configItems.js)
for details on sqlpad configuration. Note that sqlpad is used as a dependent process. It is
not necessary to also install a global instance. You can if wish, however the global instance
will not use configuration values from config.json. (There will likely be another 'sqlpaddata'
folder elsewhere on the machine shared among users of the global instance.  The sqlpal configured
sqlpad.dir will be private to the dependency (caution: collisions when the same fully qualified path  
is used may be possible - I have not adequately tested this.)

### 3. Run the CLI

    > npm update
    > npm start


#### Other Local Resources

[sqlcmd cheatsheet](./docs/cheatsheet.md)
[vim cheatsheet](./docs/vimCheatSheet.md)
[docker daemon](./docs/daemon.md)
[test extension](./docs/test.md)

