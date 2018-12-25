# Anonym 
### 

    Create, configure and restore data into a collection of running SQL Servers... 
        each isolated in a Docker Container...
            with Docker, Web and SQL Server enshrouded under TLS...
                everything self contained on a single Linux compute instance... 
                    done in a flash... 
                        for zero cash!*  
    
    Nothing else is different, you still get to lead your ultra cool SQL Server architect, developer 
    or tester life, but there will be much less killing time while you wait and much more flexibility 
    in when and where you can with work and still have all the resources you need.

    *(Must be read extremely fast) A collection of SQL Servers could be one server or one or more 
    networks, clouds, clusters, farms, federations, or availability groups of SQL Servers. "zero cash" 
    offer assumes existing hardware is repurposed as the compute instance, if hardware is planned, and 
    that the use will be appropriate to the freely distributed SQL Server Developer Image on Docker Hub. 

![Image](./docs/catalog.png)


![quickstart](./docs/quickstart.png)

## Installation

### Prerequisites
#### 64-bit Linux compute instance able to host the Docker CE Container Engine.
#### When slightly loaded, a dozen or more SQL containers may be usable on budget commodity hardware. 

    * Docker version 17 or later 
    * Node.js version 8 or later    
    * OpenSSL version 1.1l or later
    * An IDE for Linux that parses javascript and TSQL (i.e., atom, bluefish, code, etc.)

    Docker, node and OpenSSL are available through the main command-line package managers of most Linux 
    Distro's and may already be installed. The Docker daemon may already be up and running?  

### nice-to-haves 

    * RAM
    * text editor able to read-write app buffers - vi is always there, EMACs is much nicer
    * mssql_tools (The anonym relies on the sqlcmd included in the official SQL Server Container)

### Installation/Initialization 

        > mkdir anonym
        > cd anonym
        > npm install anonym
        > npm start

#### Initialize the CLI query store 

    Import (upsert) the queries from the queries.js file module into the CLI's query store. (Edit the file 
    at any time and repeat this import to upsert your changes into the store.)
        > query import

### Copy your TSQL Scripts into the scripts subfolder for use on any Contained SQL Instance.

    Individual query expressions of a few lines are better included in the query store. Scripts with more 
    than one query, join complexity or batch seperators are good candidates for script files. Scripts can 
    be added, changed or removed from the folder at any time like any other file and edited using the CLI
    linked IDE from the prompt 
        > script <scipt-name> edit 
    or from the file system with other text editors. Changes are in effect when saved.
 
    Only Scripts using the '.sql' extension will be recognized by the script command. 

#### Review and edit the config.json and sqlpad.json files as needed

        > settings --edit
        > settings --sqlpad

App Settings are found in in config.json - The config object includes settings and defaults for the CLI, the Docker
API, SQL Containers and database query connections (mssql, bcp and sqlcmd), config.json changes can be made at any 
time and are used at the next runtime reference - if that happens - else at the next application start-up as 
config.json is imported anew in entirety.

If unfamiliar with SQLPad, check out [SQLPad](https://rickbergfalk.github.io/sqlpad/)
and see this [SQLPad module source file](https://github.com/rickbergfalk/sqlpad/blob/master/server/lib/config/configItems.js)
for details on all SQLPad settings. 

mssqlconf is exposed in an option of the CLI's 'container' command

### Run the CLI

    > npm update
    > npm start

### Include the test extention 

    Adds the 'test' command to the CLI.
    > npm start test

#### Other Package Documents

[TLS](./docs/tls.md)
Details for TLS of docker API, sqlpad httpd server and     
[test CLI-command extension](./docs/test.md)
