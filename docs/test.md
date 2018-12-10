##Tests extension: 

'./tests/tests.js': A Promising Extention for the App's the Vorpal CLI

An optional module to automate multi-command work-flows. Out of the box it is useful to verify the CLI and, at the same time see what the app does and how it is used. Later, users can easily automate other custom test cycles and workflows.    

To include the extention when the app is started, pass the literal 'test' as arg[2] at the command line:
    'npm start test' 
      or 
    'node server.js test'

This will add the test command to the CLI menu. 'test' is then used as a CLI command like other commands.

API and data module test cycles are completed using a sequence of interactive CLI commands serialized on the stack. Functional unit testing is somewhat out of scope for the extension and presumed to be completed though convenient when using a well baked recipes (known to work with good data). 
 
Because the tests shipped with the app demonstrate fundamental workflows it is fun to call then "torials". Test torials... 
Run them, then review the annotated output to learn how the app works. Often, the primary command in the work flow is used as the name for that torial and passed as argument to the test command. Other commands are used to prepare for, complete, and ascertain that the app has behaved appropriately around that focal activity. Comments and usage details are sprinkled in test torials, interleaved with command output to help understand what the torial is doing as it crunches. The extraneous Tests comments are prefixed with a spyglass icon (see __about__ __icons__).

Consistent with how uncomplicated it is to add Vorpal commands and build a query store as you grow a library of scripts, the test plumbing is intended to make adding other cycles straightforward. A user familiar with javascript can write a torial. Once a user has written a torial, they have adequate skills to customize the CLI. 

Torials

Tests command sequences of CLI commands are sequentially submitted by awaiting vorpal.execSync() under a then-able  vorpal.execSync().

Container oriented Torials

    * catalog - interactive tour of the catalog using current local docker inventory
    * engine - restart the docker daemon, then re-start target container that was confirmed before restart
    * image - create and run a container from latest image

TSQL oriented Torials

    * issql - a mistake is found when query evaluated on the target, edited until correct and cleared from cache 
    * go - choose query from query store and submit to Target through Tedious.js: mssql.query()
    * run - choose script from scripts folder and ssubmit to Target through Tedious.js: mssql.batch()
    * sqlcmd - choose stored procedure, decorate and submit thru Targets's mssql-tools with output to staging 

Commands better evaluated as stand-alone commands (inclusion in torial not recommended)

    * certificate - all creds are written to file as generated and read from file as needed  
    * container - stop, start  or restart a container
    * engine - stop or start the container engine
    * history - will automate but has 7 input prompts - 3 of which must be stringified JSON
    * pull - download an image from dockerhub.com - once started, the download is async
    * sqlpad - the sqlpad server runs as dependent process but shares no state other than the CA with the app

   All included torials require that The Docker Container Engine is up with at least one SQL Server container running before the test.
    
    For test purposes, a query with a syntax error is included in the query store: 'badSyntax'. (hint: SELECT is misspelled), This - or any other query - can be edited or removed by the user.
    
Resources

    perf tools: http://www.brendangregg.com/USEmethod/use-linux.html (expert at Joyent)
