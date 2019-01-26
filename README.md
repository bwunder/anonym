# Anonym 
### Lifecycle Automaton for Locally Hosted SQL Server Containers

    Create, configure and restore data into a collection of running SQL Servers 
        ...each in its dedicated Docker Container
            ...Docker API, SQLPad HTTPS and SQL Server TDS exposed under a TLS shroud
                ...Contained on a single Linux compute instance 

Make and maintain any laptop as a conformed and universal DEV/TEST appliance. 
Share your dockerfiles or use images straight from the [dockerhub](https://hub.docker.com) website.

Many valid simulation* scenarios: Clouds, Clusters, Farms, Federations, Graphs, LANs & WANs

    Emulate any complex distributed SQL data resource (it) on one compute instance: 

        ⏺  Architects can mock it up   
        ⏺  Developers can make it up  
        ⏺  Data Analysts can cut it up
        ⏺  Data Miners can dig it out
        ⏺  Engineers can measure it up
        ⏺  Forcasters can trend it out
        ⏺  Prognosticators can take a stab at it
        ⏺  Procrastinators can hurry up and wait for it
        ⏺  Remote Workers can do anything an in-office person can do with it
        ⏺  Testers can statefully replay it
        ⏺  Trainers can teach with it  
        ⏺  Intruders that hack into it will still have to crack it  

Actual Data used can be file copies for attachment, db backups for restore, flat files for import, 
or Docker Images readied to start as appropriate to the DEV iteration or TEST cycle. 

Containers created with the app will bind 3 host Volumes: for scripts, backups and ETL.  

<sub>*Non-production use appropriate the the SQL Server "Development" PID is presumed. For uses that might 
not fall under Microsoft's "Developer" licence model please seek licensing guidance from Microsoft.</sub>

![Image](./docs/catalog.png)

![quickstart](./docs/quickstart.png)

## Installation

### Prerequisites
#### 64-bit Linux compute instance able to host the Docker CE Container Engine.
#### When lightly loaded, a dozen or more SQL containers may be usable on budget commodity hardware. 

    * Docker CE version 17 or later 
    * Node.js version 8 or later    
    * OpenSSL version 1.1l or later
    * An IDE for Linux that parses javascript and SQL (atom, bluefish, code, eclipse, sublime, etc.) 

    Docker, node and OpenSSL are available through the main command-line package managers of most Linux 
    Distro's.   

### Installation/Initialization 

    at the bash prompt ($ [command] [--option] [args...]):  
        $ mkdir anonym
        $ cd anonym
        $ npm install anonym
        $ npm start

#### Initialize the CLI query store 

    Import (upsert) the queries from the queries.js file module into the CLI's query store. (Edit the file 
    at any time and repeat this import to upsert your changes into the store.)
        $ query import

### Copy your TSQL Scripts into the scripts subfolder for use on any Contained SQL Instance.

    Individual query expressions of a few lines are better included in the query store. Scripts with more 
    than one query, join complexity or batch seperators are good candidates for script files. Scripts can 
    be added, changed or removed from the folder at any time like any other file and edited using the CLI
    linked IDE from the prompt 
        $ script <scipt-name> edit 
    or from the file system with other text editors. Changes are in effect when saved.
 
    Only Scripts using the '.sql' extension will be recognized by the script command. 

#### Review and edit the config.json and sqlpad.json files as needed

    at the CLI prompt (> command [--option] [args...]):
        > settings config
        > settings --environment
        > settings --mssqlconf
        > settings sqlpad

    App Settings are found in config.json - The config object includes the dockerhub repo name, new
    container defaults, runtime defaults and host paths use by the CLI, the Docker API, new SQL 
    Containers, query connection pragma (SET), a variety of mssql.Request presets (i.e., .query, .batch, 
    .stream) as well as SQLCMD command-line switch defaults to use. Changes to the config file, as is also 
    true for TLS credentials as detailed below, changes can be made at any time and are applied at the 
    next reference in the runtime - if that happens, at the next application start-up if the reference is 
    in the bootstrap.

If unfamiliar with SQLPad, check out [SQLPad](https://rickbergfalk.github.io/sqlpad/)
and see this [SQLPad module source file](https://github.com/rickbergfalk/sqlpad/blob/master/server/lib/config/configItems.js)
for details on all SQLPad settings. 

Container ENV vars & mssqlconf are exposed through (> settings).

### Run the CLI

        $ npm update
        $ npm start

    Work interactively in bash on any running SQL Server container (> container bash)    

### Include the [test CLI-command extension](./docs/test.md) extention (optional) 

    Adds the test command Vorpal extention module to the CLI from ../lib/tests.js. Commands in this module 
    execute commands synchronously in javascript Promise chains we can rightly consider as recipes. Users 
    may define and execute automation recipes for the automaton in the 'tests.js' file. Resistance to 
    editing core atomaton modules until a revision is properly emulated through the test module is 
    encouraged. (> test [torial]) only rollbacks are painless. 

        $ npm start test

#### [TLS](./docs/tls.md)

    Host self-signed TLS is available, configurable and applicable for the Docker Remote API, SQLPad's 
    Express http server and SQL Server connection pools featuring Almost Perfect Forward Secrecy.
    New service certificate at each app start (bash: $ npm start) and or on demand. (> certificate)

