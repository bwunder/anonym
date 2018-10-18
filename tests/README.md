test extension 

sqlpal tests simulate user input and are defined in cycles that may include one or more CLI command. In general, a cycle is named after the one command that is the focal point of the cycle with other commands used to ascertain that the app has behaved appropriately around that focus. Brief notes or explainations may also be included in test cycles in addition to command output. Tests output information extranious to normal output is prefixed with a hot pink marker.

The test command is Vorpal extension, imported and included as a test command when the literal 'test' is passed as argv[2] at start-up: 
    'npm start test' 
    or 
    'node server.js test'

CYCLES

Tests are composed of sequences of commands submitted to the app command-line by awaiting vorpal.execSync() serialized behind a then-able data entry or initial command in that sequence.  

The user is free to compose any sequence. Initially supplied sequences include
    *catalog
    *image - pull latest image from dockerhub if new, create and run a container from latest and ls
    *issql
    *go
    *run

image focused cycles
pull - download an image from dockerhub.com
run - create and start a container using any local image

container focused cycles
container - stop then start a running container
service - stop then start the SQL Server process in a running container
connection - Target the CLI at another SQL Server

batch focused cycles
issql - Verify TSQL Syntax using mssql.Request.query 
go - Execute a cached query using mssql.Request.query
run - Execute a cached query using mssql.Request.batch
sqlcmd - Execute a cached query using sqlcmd with the -Q switch (exec and return)

note: All batch cycles use queries from the queries collection in the sqlpal nedb.
User can can change the query using the --query option of the test command.

Add, edit or remove Queries from the nedb collection by editing the queries.js file located 
in the 'lib' sub-folder. Use any desktop text editor, IDE, or, from the sqlpal prompt, 'query edit' 
to launch the configured editor. Once edits are saved, the file must be upserted to the 
collection using the 'query import' command

