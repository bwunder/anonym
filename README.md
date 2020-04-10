# anonym.js <span style="font-size: small;">v0.1.4</span>  
### Javascript CLI and Query Store for SQL Server on Linux Containers

A Free and open source TSQL via Javascript CLI for the near-line Docker host. 

Create a virtual, private & self-contained replica of any multi-data-sourced, SQL Server rich live systems useful for near-line modeling, coding, testing, analytics and other manipulations of the networked data environment. Made expressly for developers and other SQL power users. 

Emulate, imitate, demonstrate or simulate clouds, clusters, farms, federations, LANs, WANs, qraphs, distributed partitions, Availability Groups, shards, replicas and many other multi-store network data environments, all on one Linux host.

- Design or model any Microsoft SQL Server rich TCP/IP network data environment
- Pull Docker Images from [Docker Hub](https://hub.docker.com)         
- Manage a catalog of local MS SQL Server Containers
- Write, edit and run _ad hoc_ and client stored T-SQL queries and a Library of T-SQL script files 
- Run bash one-off commands from the CLI prompt without losing the TSQL in the CLI's Batch cache  
- Recall previously used TSQL from client side data history and/or git source control system
- Enable a private __SQLPad__ server to add a browser GUI and charts to the tool set (requires V8) 
- Set-up TLS on the Docker API, any of the SQL Server Query Engines and/or SQLPad's Express server     
- Simultaneously access the vNET of SQL Containers and admin them as local resources on the host
- Extend the environment, and optionally the CLI, to support other data stores from [Docker Hub](https://hub.docker.com)

### OK... so what's an anonym good for?
-  Architects can model with it   
-  Developers can code, debug and test on it 
-  Data Analysts can build slicers & dicers with it
-  Data Miners can obsess and regress over it
-  Forcasters can discover trends on it
-  Network Engineers won't have to route around it
-  QA Testers can reset it to replay it, over and over and over... 
-  Trainers can teach with it, and then take it home and grade from it*  
-  Everyone can work remotely with it to get stuff done... with or without the Internet...
<sub>*If unsure the use case falls under Microsoft's "Developer" licence model, seek licensing guidance from Microsoft.</sub>

## Prerequisites
    -  64-bit Linux compute instance 
    -  Docker CE - v. 19.3.06+
    -  Git - v. 2.17.1+
    -  Node.js - v. 8.10.0+     
    -  OpenSSL - v.1.1.1+
    -  IDE (e.g., atom, bluefish, code, sublime, etc.) - file path as argument
    -  text editor (e.g., vi, emacs, nano (aka pico), kwrite, etc.) - buffer text as argument
    -  browser - SQLPad, if used, needs a browser with the V8 javascript engine 
Choosing a Linux distro for the host is out of our scope. Suffice it to say, the "official" SQL Server image is currently composed upon an "official" Ubuntu image. Linux.org offers ["the 25 most popular"](https://www.linux.org/pages/download/) distro's - all I can guarantee is the over half the links on the linux.org page will work. One finds many differing opinions on the Internet about which distro is best to use with containers, but the proofs are thin and can be biased, often nothing more than advertisements. Regardless which host distro is chosen, prerequisites are best installed through the command-line package manager recommended by the distro's maker. If a prerequisite above did not come with the host linux instance, it will invariably be available from one of that package managers configured repoitories. 

Choosing an IDE and an editor are also beyond scope. It is anticipated that the IDE already in use will work just fine. All the CLI does with the IDE is asynchronously launch it with a file path argument. The editor can be used to do this as well, but won't be as pleasant of an experience as reviewing or working with javascript, JSON, HTML or TSQL as it is in one of todays better open source IDEs that work with Linux.  

As to the editor, a Linux distro that ships without vi and does not also includes one or more other text editors is a hard to find. I personally prefer EMACs ove vi. EMACs will surely be in the package manager's repository, however it is rarely installed by default. The base requirement for full CLI functionality is that the editor accept text from stdin (buffered data) as the first positional argument and the IDE must accept a file path as the first positional arg. Thus the need to specify both an editor and an IDE in the './config/config.json' file.        

Matters not to the CLI which browser is used. However, SQLPad will only work with the V8 javascript engine. This limits the choices to browser based on the open source Chromium project (e.g., Blisk, Brave, Chrome, Opera, Vivaldi, etc.) if you plan to use the private SQLPad.   

## Install
At the bash terminal prompt:  
  <pre>
    <span style="color: #55FF55;"><b>bill@HOST</b></span>$ npm update
    <span style="color: #55FF55;"><b>bill@HOST</b></span>$ mkdir anonym
    <span style="color: #55FF55;"><b>bill@HOST</b></span>$ cd anonym
    <span style="color: #55FF55;"><b>bill@HOST</b></span>:<span style="color: #5555FF;"><b>~/anonym</b></span>$ npm install anonym </pre>

The user is prompted with the option to pull the latest SQL Server Image from the Docker hub if no local Images are found at CLI start-up. This is described in the Launch section below. The first time the CLI is started it is preferable to decline the pull and review/adjust the configuration as desired.  

## Configure
Most configurations used by the CLI are set in the './config/config.json' file. The file can be edited before launching the CLI or, from within the CLI, the file can be launched for edit in the configured IDE. The values most important to configure, once the CLI is installed, are the IDE and editor. The editor defaults to 'vi' when not configured. The IDE has no default, although it is most likely already be set in the config file to use <b>Visual Studio code</b>. 

To open the config file and set the IDE and editor from the CLI use:  
  <pre>anonym &gt; <span style="color: #00AAAA;">settings config</span></pre>  
This will try to open the config file in the configured IDE. If the IDE is not present locally or not configured, the file will try to open in configured editor. If the editor is not present, the file will open in vi. If you don't know vi well enough to edit a text file or pull up the help documentation, have a peak at './docs/html/vimCheatSheet.html' in your browser. If the host Linux instance is configured to not open the GUI, consider one of the text only browsers that run in the terminal like Lynx. Much of the CLI documentation and source code can be viewed at the prompt or, especially to improve readability of larger documents, in a browser.  

The defaults will get the Cli rolling and may be satisfactory as is as you evaluate the CLI, but the configuration is fully under the control of the user. 

The config file includes default values for several secrets. However, on first use or on demand, the user is prompted for a different secret. Secrets are obfuscated and stored in the CLI's secret store for later recall. The values in config make for an interesting honeypot once other values are set for these secrets.    

## Launch
  <pre>
    <span style="color: #55FF55;"><b>bill@HOST</b></span>:<span style="color: #5555FF;"><b>~/anonym</b></span>$ npm start

    anonym &gt; anonym@0.1.4 start /home/bill/anonym
    anonym &gt; node anonym.js

    <span style="color: #55FFFF;"><b>🖧</b></span>  
    <b>🧿</b>  <span style="color: #FFFF55;">No Local SQL Images found</span>
    <span style="color: 00AA00;">?</span> <b>Pull the latest SQL Image now? </b> (Y/n)  </pre>

This mini dashboard is output each time the catalog of SQL Server Docker artifacts map is buffered. The first line, prefixed with a network ucon (i.e., unicode icon), extends as a series of large dots. First in line are blue dots for each local image. These are followed by a set of red or green dots for each local SQL Container: red if idle, green if running. There are several examples of the dashbord shown below.

The second line, prefixed with the target like ucon (<b>🧿</b>), provides a status message regarding the SQL Container currently selected as the target of CLI originated TSQL queries. When the most recently targeted Container is found and is running, this line becomes a SQL connection status message and the ucon changes to the assigned to SQL Server messages (<span style="color: #FFA500;"><b>ᛞ</b></span>).      

A re-inventory and remapping of the catalog of SQL in Docker artifacts that underlies the dashboard occurs as the CLI is started. And again each time a container is stopped or started by the CLI, or an Image or Container is added or removed using the CLI, when a connection pool is opened or closed to by CLI, or when the CLI's Target SQL Server is changed. Remapping can also be invoked at any time by the user at the prompt:
  <pre>anonym &gt; <span style="color: #00AAAA;">catalog remap</span></pre>

## The Catalog
The most vital of the CLI's innards is the Catalog of SQL Server on Linux Docker artifacts. This Javascript Object of Maps filters out any non-SQL Server Images and Containers, including the private SQLPad server if used, then snapshots the local Docker API SQL Server Image and Container objects. It also keeps track of the SQL Server the CLI is currently targeting when submitting TSQL and the CLI to SQL Server connection pools opened in the current CLI session. 

Once one or more SQL Server Images have been pulled from the hub.docker.com: 
  <pre>anonym &gt; <span style="color: #00AAAA;">image pull</span></pre>
And the configuration has been adjusted as needed (described below), SQL Container Instances can be created from the user's choice among the local images: 
  <pre>
    anonym &gt; <span style="color: #00AAAA;">image run</span>
    <span style="color: #00AAAA;">?</span> <b>Select from local SQL Images </b> (Use arrow keys)
    <span style="color: #00AAAA;">❯ 56655b462301</span> 
      a8343d3ce21c 
      ba266fae5320 
      d273eadd9675 </pre>
Then any SQL Container can be set as the current __Target__ for CLI originated TSQL queries:
  <pre>
    anonym &gt; <span style="color: #00AAAA;">connection target</span>
    <span style="color: #00AAAA;">?</span> <b>Target for CLI originated SQL queries </b> (Use arrow keys)
      5004ba923fda 
      57f9ee49483d 
    <span style="color: #00AAAA;">❯ 9d51eb524061</span> 
      c41e3ae7719b 
      cf030328e0aa </pre>
At this point, the CLI will launch with a visual showing the state of the host's collection of SQL Containers or the __Catalog__, here seen as 4 blue Images, 1 green - or running - Container, 4 red - or idle - containers behind the __catalog.js__ module's designated unicode icon (ucon) signaling the origin of the output line with the status of the CLI to Target SQL connection pool below, behind the ucon (<span style="color: #FFA500;"><b>ᛞ</b></span>) that indicates the message originated in the __sqldb.js__ module.
  <pre>
    <span style="color: #55FF55;"><b>bill@HOST</b></span>:<span style="color: #5555FF;"><b>~/anonym</b></span>$ npm start
    &nbsp;
    &gt; anonym@0.1.4 start /home/bill/anonym
    &gt; node anonym.js
    &nbsp;
    <span style="color: #55FF55;"><b>🖧</b></span>  <span style="color: #5555FF;"><b>●●●●</b></span> <span style="color: #FF5555;"><b>●</b></span><span style="color: #55FF55;"><b>●</b></span><span style="color: #FF5555;"><b>●●●●</b></span>
    <span style="color: #FFA500;"><b>ᛞ</b></span>  Pool open: db master in sql container 9d51eb524061
    &nbsp;
    anonym &gt;
  </pre>
If the host is booted or the Docker daemon restarted or the Target Container has been previously stopped by the user - and assuming the same Catalog artifacts as shown above - the launch changes slightly, by extending an offer to restart the Target Container if it is discovered to be idle at CLI start:
  <pre>
    <span style="color: #55FF55;"><b>bill@HOST</b></span>:<span style="color: #5555FF;"><b>~/anonym</b></span>$ npm start
    &nbsp;
    &gt; anonym@0.1.4 start /home/bill/anonym
    &gt; node anonym.js
    &nbsp;
    <span style="color: #55FFFF;"><b>🖧</b></span>  <span style="color: #5555FF;"><b>●●●●</b></span> <span style="color: #FF5555;"><b>●●●●●</b></span>
    <b>🧿</b>  <span style="color: #FFFF55;">Target SQL Server not started</span>: 9d51eb524061
    <span style="color: 00AA00;">?</span> <b>Start Target Container now? </b> (Y/n)  </pre>
Reviewing the complete collection of Maps in entirety can be a daunting amount of JSON data, but is always possible. Each Image needs around 15 display lines and each container over 50. Give it a try, and take a moment to review the content details: 
  <pre>anonym &gt; <span style="color: #00AAAA;">catalog all</span></pre>
More usable summary views are the is the default shown by the catalog command:
  <pre>
    anonym &gt; <span style="color: #00AAAA;">catalog </span>
    <span style="background-color:#FFFFFF"><span style="color: #3F3F3F;">    Images Pulled             </span></span>
    56655b462301  (v.15.0.4013.40)  mcr.microsoft.com/mssql/server:latest
    a8343d3ce21c  (v.14.0.3281.6)  mcr.microsoft.com/mssql/server:2017-latest
    d273eadd9675  (v.15.0.4003.23)  mcr.microsoft.com/mssql/server:2019-latest
    ba266fae5320  (v.15.0.2070.41)  
    <span style="background-color:#FFFFFF"><span style="color: #3F3F3F;">    Containers Created        </span></span>
    f0eeeae7a2ab  v.15.0.4013.40    /infallible_lederberg  <span style="color: #00AA00;">started</span> 2020-03-05T14:09:57.895652979Z
    9d51eb524061  v.15.0.4003.23    /edgy                 <span style="color: #00AA00;">started</span> 2020-03-05T12:16:40.51643927Z
    c41e3ae7719b  v.15.0.2070.41    /suspicious_chaum     <span style="color: #AA0000;">stopped</span> 2020-01-28T04:01:03.54556645Z
    cf030328e0aa  v.15.0.2070.41    /infallible_yonath    <span style="color: #00AA00;">started</span> 2020-03-05T14:25:16.348549127Z
    57f9ee49483d  v.15.0.2070.41    /SQL2                 <span style="color: #AA0000;">stopped</span> 2020-01-30T04:59:02.289279034Z
    <span style="color: #55FFFF;"><b>5004ba923fda</b></span>  v.15.0.2070.41    /SQL1                 <span style="color: #00AA00;">started</span> 2020-03-05T14:09:30.135737069Z
    <span style="background-color:#FFFFFF"><span style="color: #3F3F3F;">    Pools Opened              </span></span>
    cf030328e0aa using &apos;master&apos; as &apos;sa&apos; on port 38793
    <span style="color: #55FFFF;"><b>5004ba923fda</b></span> using &apos;undefined&apos; as &apos;sa&apos; on port 46769
    anonym &gt; </pre>
Another view of the catalog, perhaps most interesting when defining database connections, shows both the virtual network IP address and the host port mapping of each running SQL Container. Data connections can be made to the IP address or ContainerId over the VNET to the well-known 1433 port or as local instances on the host using the port shown. By default, the CLI connects through the docker assigned local port of the host. This port mapping is pseudo-randomly generated by the CLI's <em>get-port</em> dependency and assigned at the time a container is created.   
  <pre>
    anonym &gt; <span style="color: #00AAAA;">catalog network </span>
    Map {
      <span style="color: #00AA00;">&apos;f0eeeae7a2ab  /infallible_lederberg&apos;</span> =&gt; { bridge: <span style="color: #00AA00;">&apos;172.17.0.4:1433&apos;</span>, port: <span style="color: #00AA00;">&apos;39021&apos;</span> },
      <span style="color: #00AA00;">&apos;9d51eb524061  /edgy&apos;</span> =&gt; { bridge: <span style="color: #00AA00;">&apos;172.17.0.2:1433&apos;</span>, port: <span style="color: #00AA00;">&apos;43527&apos;</span> },
      <span style="color: #00AA00;">&apos;cf030328e0aa  /infallible_yonath&apos;</span> =&gt; { bridge: <span style="color: #00AA00;">&apos;172.17.0.5:1433&apos;</span>, port: <span style="color: #00AA00;">&apos;38793&apos;</span> },
      <span style="color: #00AA00;">&apos;5004ba923fda  /SQL1&apos;</span> =&gt; { bridge: <span style="color: #00AA00;">&apos;172.17.0.3:1433&apos;</span>, port: <span style="color: #00AA00;">&apos;46769&apos;</span> } }
    anonym &gt; 
  </pre>
Useful information when defining SQL Connections in SQLPad and other apps being run in the anonym or when connecting remotely to the anonym. Beware, if you do open a path to connect remotely that you have created a backdoor. This will not necessarily lead to cross-talk between the anonym Instance and another data network, but it is, like any backdoor,  vulnerable to malice.  

## CLI Query Target
The Target is the SQL Server Container chosen by the user to be the recipient of TSQL queries from
the CLI. Any container can be set as the Target, however only one Target at a time is allowed. If a Target has been set previously, it is highlighted in the list of choices and has the focus. WHen no previous Target is detected by the code, the list appears with the first list item highlighted.
  <pre>
    anonym &gt; <span style="color: #00AAAA;">connection target</span>
    <span style="color: #00AA00;">?</span> <b>Target for CLI originated SQL queries </b> (Use arrow keys)
      5004ba923fda 
      57f9ee49483d 
      9d51eb524061 
      c41e3ae7719b 
    <span style="color: #00AAAA;">❯ cf030328e0aa</span></pre>
Selecting a Target does not change the state of the newly Targeted Container, however the user is invited 
to start the Target if it is not running. The Target Container must be running before queries can submitted to that Target.
  <pre>
    anonym &gt; <span style="color: #00AAAA;">connection target</span>
    <span style="color: #00AA00;">?</span> <b>Target for CLI originated SQL queries </b> <span style="color: #00AAAA;">cf030328e0aa</span>
    <span style="color: #55FFFF;"><b>🖧</b></span>  <span style="color: #5555FF;"><b>●●●●</b></span> <span style="color: #55FF55;"><b>●</b></span><span style="color: #FF5555;"><b>●●●</b></span><span style="color: #55FF55;"><b>●</b></span>
    <b>🧿</b>  <span style="color: #FFFF55;">Target SQL Server not started</span>: cf030328e0aa
    <span style="color: 00AA00;">?</span> <b>Start Target Container now? </b> (Y/n)  </pre>

## CLI Query Termination
Termination describes the act of sending the query now in the Batch cache to a SQL Server. These 
CLI commands terminate the Batch (all lower case) once entered:  
    __go__       - mssql.Request.query() via tedious.js
    __run__      - mssql.Request.batch() via tedious.js
    __sqlcmd__   - mssql-tools (loosely speaking, this is ODBC)
    __stream__   - mssql.Request.batch() via tedious.js with the response handled through events
- Upon termination, the query in the Batch cache is submitted to the Target's Query Engine. 
- Results returned through 'tedious.js' are displayed as JSON. 
- Results returned from sqlcmd are displayed in tabular format. 
- Only Terminators can/will execute a query from cache. 
There is also a pseudo-terminator, expose in __batch issql__ (aka __? issql__), that, from the console vantage, works just like the real terminators. The big difference is __batch issql__ submits the query wrapped between __SET NOEXEC ON__ and  __SET NOEXEC OFF__ , thus getting the same syntax checking as a query terminated for execution without actually risking a touch of the data. This pseudo-terminator can be enabled for all queries (recommended) by setting the value of config.cli.checkSyntax to true. When true, each terminated query is check for syntax errors and will return the first error with no risk of corrupting data by running a multi-statement batch with syntax errors that fails in the middle of a data manipulation.  

## CLI _ad hoc_ Queries
TSQL entered at the command prompt accumulates each line entered into a Batch Cache. Consider an example. (And notice the missing comma after the database_id column in the select list, we will fix that in a moment.):
  <pre>
    anonym &gt; <span style="color: #00AAAA;">SELECT name,</span>
    anonym &gt; <span style="color: #00AAAA;">database_id</span>
    anonym &gt; <span style="color: #00AAAA;">USER_NAME(owner_sid)</span>
    anonym &gt; <span style="color: #00AAAA;">FROM sys.databases</span>
    anonym &gt; </pre>
When the query is terminated - here we use the __go__ terminating command - and mistakes like this missing comma bug are found, SQL Server returns the error message, the CLI handles it and keeps going:
  <pre>
    anonym &gt; <span style="color: #00AAAA;">go</span>
      <span style="color: #FF5555;"><b>❎</b></span>  <span style="color: #FF5555;">(sqldb) SQL Server error</span> 
                Number:  102 
                Class:   15 
                State:   1 
                Line:    4
                Message: Incorrect syntax near &apos;owner_sid&apos;.
    &nbsp;
      <span style="color: #FF5555;"><b>❎</b></span>  <span style="color: #FF5555;">(sqldb) error</span>
      Error: (query) SELECT name,
      database_id
      USER_NAME(owner_sid)
      FROM sys.databases
          at Promise (/home/bill/anonym/lib/sqldb.js:78:33)
          at &lt;anonymous&gt;
          at process._tickCallback (internal/process/next_tick.js:188:7)
    &nbsp;
    anonym &gt; </pre>
But the Batch cache is left as is when an error occurs. The user then determines whether to edit the Batch or to simply clear the cached query. During the edit, the CLI event loop will be blocked while the query is opened in the editor: 
  <pre>anonym &gt; <span style="color: #00AAAA;">batch edit</span></pre>
Alternately, the __batch__ command's alias (in this case, a shortcut) can be used:
  <pre>anonym &gt; <span style="color: #00AAAA;">? edit</span></pre>
And, in either case, the CLI's TAB-key based autocomplete functionality may be invoked
  <pre>
    anonym &gt; <span style="color: #00AAAA;">b[TAB] e[TAB]</span>
    - or -
    anonym &gt; <span style="color: #00AAAA;">? e[TAB]</span></pre>
When changes are 'saved' within the editor and the editor is exited, the node.js event loop resumes. To review the changes any time the event loop is active:
  <pre>
    anonym &gt; <span style="color: #00AAAA;">?</span>
    SELECT top 1 name,
    database_id,
    USER_NAME(owner_sid)
    FROM sys.databases
    anonym &gt; </pre>
Or Terminated again to produce the sought result set at the CLI:
  <pre>
    anonym &gt; <span style="color: #00AAAA;">go</span>
    { name: <span style="color: #00AA00;">&apos;master&apos;</span>, database_id: <span style="color: #AA5500;">1</span>, <span style="color: #00AA00;">&apos;&apos;</span>: <span style="color: #00AA00;">&apos;dbo&apos;</span> }
    rowsAffected: 1
    anonym &gt;</pre>
Successful query execution logs the query and rowsAffected to history then truncates the Batch cache to prepare it for a new query:
  <pre>
    anonym &gt; <span style="color: #00AAAA;">?</span>
    nothing in cache
    anonym &gt;</pre>

## CLI Query Store 
The './lib/queries.js' module contains only a javascript export object of named TSQL queries. Review, add, remove, and modify the queries in this file, then import the queries into the CLI's query store document database.
  <pre>anonym &gt; query import</pre>
From this point, any query in the store can be quickly loaded into the CLI's Batch cache:
  <pre>
    anonym &gt; <span style="color: #00AAAA;">query</span>
    <span style="color: #00AA00;">?</span> <b>query to load into the Batch </b> (Use arrow keys)
    <span style="color: #00AAAA;">❯ advancedOptions</span> 
      badSyntax_invalidObject 
      badSyntax_misspelling 
      badSyntax_notSQL 
      badSyntax_null 
      badSyntax_undefined 
      badSyntax_whitespace 
    <span style="color: #AAAAAA;">(Move up and down to reveal more choices)</span></pre>
Loading a stored query into the Batch cache replaces anything that was previously held in the Batch cache.   

To effect changes to one or more stored queries, the user can edit the './lib/queries.js' file, save the changes and then re-import into the store (it's an upsert).  
  <pre>
    anonym &gt; <span style="color: #00AAAA;">query develop </span>
    <span style="color: #55FF55;"><b>🗸</b></span>  (spawnTask) Submitted bashCommand: code /home/bill/anonym/lib/queries.js
    anonym &gt; <span style="color: #00AAAA;">query import </span>
    query store is now overwritten with definitions from queries.js
    anonym &gt;</pre>
Or edit a stored query and then sync the changes back to the './lib/queries.js' module      
  <pre>
    anonym &gt; <span style="color: #00AAAA;">query edit </span>
    <span style="color: #00AA00;">?</span> <b>Query to edit </b> <span style="color: #00AAAA;">badSyntax_misspelling</span>
    anonym &gt; <span style="color: #00AAAA;">query sync</span>
    query store has overwritten queries.js
    anonym &gt;</pre>
Or load the query to the Batch cache first, then edit only the copy of the query in cache
  <pre>
    anonym &gt; <span style="color: #00AAAA;">query load </span>
    <span style="color: #00AA00;">?</span> <b>query to load into the Batch </b> <span style="color: #00AAAA;">badSyntax_invalidObject</span>
    anonym &gt; <span style="color: #00AAAA;">? edit </span>
    anonym &gt; <span style="color: #00AAAA;">?</span>
    SELECT top 1 * FROM sys.configurations
    anonym &gt;</pre>
Keeping the './lib/queries.js' module and the store synchronized helps to assure that the store is accurately documented within source control.     

## CLI Script Library
The user can copy and grow his or her collection of TSQL Scripts into the './scripts' subfolder. From here, scripts can me Developed, debugged, tested and run on any SQL Instance in the Catalog. While the query store is more convenient for brief queries, Multi-statement scripts are often easier to work with in files. Scripts with DDL, more than one query, deep join complexity, SQLCMD variables or multiple batches that may require changes between uses were meant to be in scripts or stored procedures. Scripts can be added, changed or removed from the folder, which is under source control, at any time and opened for edit on demand. Only Scripts having the '.sql' extension are recognized by the script command.
Edit a script in the configured IDE (config.ide) asynchromously:
  <pre>anonym &gt; script develop</pre>
or edit a script in the configured editor (config.editor) - statefully blocking the event loop:
  <pre>anonym &gt; script edit</pre>
or use your preferred tactics external to the CLI app. In all scenarios, changes are in effect once 
saved - and source control will pick-up the changes.

Like the stored queries described above, scripts can also be edited once loaded to the Batch cache 
without changing the file contents. 

Load a script to the Batch Cache:
  <pre>
    anonym &gt; <span style="color: #00AAAA;">script</span>
    <span style="color: #00AA00;">?</span> <b>Select script to load to Batch cache </b> 
      defaultTrace 
      dumps 
      Formatmessage 
    <span style="color: #00AAAA;">❯ linkedServerTest</span> 
      restoreAdventureWorks 
      restoreWideWorldImporters 
      ringBufferSummary 
    <span style="color: #AAAAAA;">(Move up and down to reveal more choices)</span></pre>
Edit only the copy of the script now in the Batch cache:
  <pre>
    anonym &gt; <span style="color: #00AAAA;">script</span>
    <span style="color: #00AA00;">?</span> <b>Select script to load to Batch cache </b> <span style="color: #00AAAA;">linkedServerTest</span>
    anonym &gt; batch edit</pre>
 



