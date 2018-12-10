## CLI automation tools for local SQL Server Containers:
### Create Private, Autonomous Virtual Distributed Data Topologies on a laptop   


![Image](./docs/catalog.png)

Scalability not withstanding, architectural form and function can be accurately defined or 
reproduced very quickly with little brain smoke and minimal expenditures through the magic of 
the Open Source software. Here, the Node.js event loop and Docker Containers loaded with SQL Server 2017, along with interogative knowledge of the configurations in use in the environment.

The app expects at least occassional Internet access to obtain the latest versions of 
Microsoft's "Official" SQL Server for Linux Developer Edition image from dockerhub.com and 
code package revs from npmjs.com as they become available. 

SQL Server versions and/or products run effortlessly side-by-side. 

Use Cases
Remote or irregularly Internet Connected Developers and testers
Rapid Rebuild/recoveries when test cycles are data destructive
Vendor patch and version deployment previews 
AI
Continuous Integration (CI) Testing
Robotics (Complex Integration) Testing
Hub for spoke Training Databases (on the Trainer's laptop so can be readied in transit) 
    Trainee's could use PCs, cell phones, tablets, Raspberry Pis, cache registers, etc. 
Many other applications, collaborations and innovations are enabled 

## Installation

### 1. Prerequisites
#### Docker, Node.js and OpenSSL

It is recommended that the primary package repo and the CLI package manager for your Linux
OS. e.g., apt-get, rpm, yast, yum, zypper, etc. else local compile from source is used to
complete this step. 

### 2. Init
#### Prepare and enter a new folder

Periodic password prompts from the OS maintain the user's sudo access to the compute instance
Deploying the app under the current user's $HOME is required to avoid. With this practice, 
multiple people can run a personal app instance and all can use the same containers as necessary 
with each having a personal CLI activity history much like *$HOME/.bash_history*
except stored in the client's document database providing improved query & search support.

    > mkdir anonym
    > cd s

#### move the reviewed source from the anonym github project into folder created

    > https://www.github.com/bwunder/anonym

#### (optional) Define queries available to the runtime by editing the queries.js module file.

In general, shorter queries that need no modification and expect no parameters are
best suited for embedding as template strings, however, the user is always free to decide what
belongs in queries and what should be a script (we add those below). Scripts have the decided
advantage of being accessible and usable from other tools. Queries have the decided advantage
of __not__ being useful

Copy and paste any TSQL queries desired and enclose with template string delimiters (`back-ticks`).
Queries are upserted into the 'templates.db' nedb database at each application start-up: all
additions, changes and deletions applied since the last start-up are reported in the log.

Queries can be added, edited or removed at any time using the anonym CLI. Changes take effect immediately
in anonym beginning with the next query after the query is saved.

#### (optional) Copy or move TSQL Scripts into the scripts subfolder.

Individual query expressions are nicely for inclusion in templates.db. Scripts with more than one
query are probably better stored as script files. Scripts can be added, changed or removed from the
folder at any time like any other file or from the anonym CLI (**script <file-name> --edit**). Changes
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
folder elsewhere on the machine shared among users of the global instance.  The anonym configured
sqlpad.dir will be private to the dependency (caution: collisions when the same fully qualified path  
is used may be possible - I have not adequately tested this.)

### 3. Run the CLI

    > npm update
    > npm start

### Other Local Resources
[sqlcmd cheatsheet](./docs/cheatsheet.md)
[vim cheatsheet](./docs/vimCheatSheet.md)
[docker daemon](./docs/daemon.md)
[test extension](./docs/test.md)

