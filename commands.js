//// NPM
const Vorpal = require('vorpal')
const vorpalLog = require('vorpal-log')
//// core
const fs = require('fs')
const path = require('path')
//// local
const config = require(`./config.json`)
const package  = require('./package.json')
const sqldb = require('./sqldb')
//const test = require('./test/test')
const api = require('./api')
const store = require('./store')

const sqlName=`SQL Server for Linux`.italic
const Batch = config.batch
let appStart = new Date()

const vorpal = new Vorpal()
  vorpal
    .use( vorpalLog, { printDate: config.printDate } )
    .delimiter( `${config.vorpal.port}`.rainbow+'>' )
    .show()

  vorpal.logger.setFilter(config.vorpal.loglevel)
  let log = vorpal.logger
  log.log(api.bandAid)
  config.log=log

  // no deletes, just upserts - so will no-op with unknown fixed (small I bet) cost most of the time
  store.queries.import()

  // Maps to error for socket.io-client
  vorpal.on('client_error', (err) => {
    log.warn(`[CLI error]`.magenta)
    log.error(err.message)
    log.debug(err.stack)
    store.clients.put({ error: err, event: 'client_error' })
  })

  vorpal.on('client_prompt_submit', (data) => {
    if (data!='') { // ignore empty lines
      log.debug(`[vorpal client_prompt_submit] ${api.format(data)}`.magenta)
      store.lines.put(data, 'client_prompt_submit')
    }
  })

  vorpal.on('client_command_error', (err) => {
    log.warn(`[CLI command error]`.magenta)
    log.error(err)
    store.clients.put(err, 'client_command_error')
  })

  vorpal.on('client_command_executed', (data) => {
   log.debug(`[vorpal client_command_executed]\n${api.format(data)}`.magenta)
   store.commands.put({event: 'server_command_error'})   // using client_prompt_submit instead for logging
  })

  // could easily be modified or cloned to use su or sudo for elevation
  vorpal.command(`engine`, `Host Docker Engine Administration (requires root access on '${process.env.HOST}')`.blue)
  .option(`-s, --status`, `Report on Current Status default`)
  .option(`--start`, `Start Container Engine`)
  .option(`--stop`, `Stop Container Engine`)
  .action( (args, callback) => {
    switch(Object.keys(args.options)[0]) {
      case ("start"):
      case ("stop"):
        api.setEngine(Object.keys(args.options)[0])
        api.loadCatalog()
        break
      case ("status"):
      default:
        api.setEngine(Object.keys(args.options)[0])
        break
    }
    callback()
  })

  vorpal.command(`image`, `SQL Server for Linux Docker Images`.blue)
  .option(`-a, --all`, `List Images in Host\'s Catalog`)
  .option(`-f, --full [image-id]`, `Show a Hosted ${sqlName} Docker Image (Target\'s image if no id entered)`)
  .option(`-i, --id`, `Show Id of Target Container\'s Image`)
  .option(`--pull`, `Fetch '${config.docker.repo}:latest' from the Dockerhub Repository`)
  .option(`--run <image-id>`, `Create a New Container using an Image from Host\'s Catalog`)
  .action( (args, callback) => {
    api.isDocker()
    .then( async (running) => {
      let imageId=args.options[0]
      if (!imageId && api.sqlCatalog.Instance) {
        imageId=api.getContainerInfo().ImageID
      }
      if (running) {
        switch (true) {
          case (args.options.all):
            log.log(api.listImages())
            break
          case (typeof args.options.full==='string'):
            log.log(api.format(await api.getImage(args.options.full)))
            break
          case (args.options.full):
            log.log(api.format(await api.getImage()))
            break
          case (args.options.id):
            if (!imageId) {
              log.warn(`No Target (set one with 'instance -i <container-id>')`)
            } else {
              log.log(`Image of Target Instance: ${imageId}`)
            }
            break
          case (args.options.pull):
            log.log(await api.pullImage())
            break
          case (typeof args.options.run===`string`):
            log.log(await api.runImage(args.options.run))
            await api.loadCatalog()
            break
          case (args.options.run):
            log.log(await api.runImage())
            await api.loadCatalog()
            break
          default:
            log.log(`Target Image: ${imageId}`)
            break
        }
      }
      callback()
    })
    .catch( (err) => {
      api.log('warn', `(command image) error`)
      api.log('error', err)
    })
    .then( () => {
      callback()
    })
  })

  vorpal.command(`instance`, `SQL Server for Linux Docker Containers`.blue)
  .alias('~')
  .option(`-a, --all`, `See Local SQL Server Containers`)
  .option(`-b, --bash [container-id]`, `Open Interactive bash shell in a Cataloged Container`)
  .option(`-c, --connection [`+`O`.underline+`PEN|`+`C`.underline+`LOSE]`, `See [or Set] Connection Pool State of Target SQL Instance`)
  .option(`-e, --entity [container-id]`, `See Container\'s docker+node API Entity Object`)
  .option(`-f, --full [container-id]`, `See Container\'s definition`)
  .option(`-l, --last [n]`, `See Last n (default 3) SQL Containers Created`)
  .option(`--remove <container-id>`, `Remove a Container - container-id mandatory`)
  .option(`--restart [container-id]`, `Restart a Container - only if 'running', default is Target`)
  .option(`--start [container-id]`, `Start a Container - if not already 'running', default is Target`)
  .option(`--stop [container-id]`, `Stop a Container - default is Target`)
  .option(`-t, --target [container-id]`, `See [or Set] CLI Target Container`)
  .action( async (args, callback) => {
    let containerId, targetId
    if (await api.isDocker()) {
      let lastTargetId=api.sqlCatalog.Instance
      if (typeof args.options[Object.keys(args.options)[0]]==='string' &&
        api.sqlCatalog.ContainerInfos.has(args.options[Object.keys(args.options)[0]])) {
          containerId=args.options[Object.keys(args.options)[0]]
      } else if (typeof args.options[Object.keys(args.options)[0]]==='boolean') {
        containerId=lastTargetId
      }
      switch(Object.keys(args.options)[0]) {
        case ("all"):
          log.log(api.format(api.listContainers()))
          break
        case ("bash"):
          api.interactiveShell(containerId)
          break
        case ("connection"):
            if (/^cl*o*s*e*$/i.test(args.options.connection)) {
              log.log(await sqldb.closePool())
            } else if (/^op*e*n*$/i.test(args.options.connection)) {
              log.log(await sqldb.openPool())
            } else {
              log.log(`connection pool state: ${sqldb.state()}`)
            }
          break
        case ("entity"):
          log.log(api.format(api.getDockerContainer(containerId)))
          break
        case ("full"):
          log.log('api.sqlCatalog.ContainerInfo'.inverse)
          log.log(api.format(api.getContainerInfo(containerId)))
          log.log('api.sqlCatalog.Image'.inverse)
          log.log(api.format(await api.getImage(api.getContainerInfo(containerId).ImageID)))
          break
        case ("last"):
          log.log(api.format(await api.latestContainers(args.options.last)))
          break
        case ("remove"):
          if (api.getContainerInfo(args.options.remove).State!='running') {
            log.log(api.format(await api.removeContainer(args.options.remove)))
          } else {
            log.warn(`Container must be stopped before it can be removed`)
          }
          break
        case ("restart"):
          if (typeof args.options.restart==='string') {
            await api.restartContainer(args.options.restart)
          } else {
            await api.restartContainer(api.sqlCatalog.Instance)
          }
          break
        case ("start"):
          if (typeof args.options.start==='string') {
            await api.startContainer(args.options.start)
          } else {
            await api.startContainer()
          }
          break
        case ("stop"):
          await api.stopContainer(containerId)
          break
        case ("target"):
          if (containerId && containerId!=api.sqlCatalog.Instance) {
            await api.loadCatalog(containerId)
          }
          break
        default:
          log.log(`Target Container: ${api.sqlCatalog.Instance}`)
          break
      }
    }
    callback()

  })

  vorpal.command(`bcp [options]`, `Bulk Copy Data in or out of Target using BCP from mssql-tools`.yellow)
  // .option(`-i, --input [data-file| T-SQL | TABLE | VIEW ]`, `source of data`)
  // .option(`-o, --output [data-file]`, `result output file (default stdout)`)
  .action( (args, callback) => {
    log.log(api.bandAid)
    log.debug(`sorry, nothing here. Exit and at bash prompt use the host\'s BCP in /mssql-tools,
      or use the BCP included in the Target SQL Server container (sqlpal command: 'instance --bash')`)
    callback()
  })

  vorpal.command(`bulk <table>`, `Bulk Insert data using mssql bulk mode`.yellow)
  // .option(`-i, --input [data-file| T-SQL | TABLE | VIEW ]`, `source of data`)
  // .option(`-o, --output [data-file]`, `result output file (default stdout)`)
  .action( (args, callback) => {
    log.log(api.bandAid)
    log.debug(`sorry, nothing here. Exit and at bash prompt use the host\'s BCP in /mssql-tools,
      or use the BCP included in the Target SQL Server container (sqlpal command: 'instance --bash')`)
    callback()
  })

  vorpal.command(`sqlcmd`, `Process a cached batch or file script on Target using SQLCMD`.green)
  .option(`-e, --execsql`, `Process batch via sp_executesql, `+`after`.italic+` the prefix executes`)
  .option(`-i, --input <script-file>`, `process a T-SQL script file rather than the batch`)
  .option(`-Q, --Query`, `Process the prefixed batch and exit, rendering JSON results`)
  .option(`-p, --prefix [`+`e`.underline+`dit]`, `Inspect/Edit SET Statement(s) prefixed to all queries`)
  .option(`-q, --query`, `Process the prefixed batch in sqlcmd, rendering tabular results`)
  .option(`-o, --output <data-file>`, `write result to the file - one of [e, i, Q or q] also required`)
  .option(`-s, --switch [switch-flag]|[`+`e`.underline+`dit]`, `Inspect/Edit Command-line switch defaults`)
  .action( async (args, callback) => {
    // different containerId could be used behind -H switch, what happens then?
    let containerId = api.sqlCatalog.Instance
    if (containerId) {
      let cmdArgs = []
      let sqlArg = ''
      switch(true) {
        case (args.options.execsql):
          sqlArg=`-Q "${api.compile(config.sqlcmd.prefix)} exec sp_executesq('${api.compile(Batch)}')"`
          break
        case (typeof args.options.input==='string'):
          sqlArg=`-i "${args.options.input}"`
          break
        case (/^ed*i*t*$/i.test(args.options.prefix)):
          log.log(await api.editBuffer(api.compile(config.sqlcmd.prefix)))
        case (args.options.prefix):
          result=config.sqlcmd.prefix
          break
        case (/^ed*i*t*$/i.test(args.options.switch)):
          log.log(await api.editBuffer(api.compile(config.sqlcmd.prefix)))
        case (args.options.switch):
          result=config.sqlcmd.switch
          break
        case (args.options.Query):
          sqlArg=`-Q "${api.compile(config.sqlcmd.prefix)} ${api.compile(Batch)}"`
          break
        case (args.options.query):
          sqlArg=`-q "${api.compile(config.sqlcmd.prefix)} ${api.compile(Batch)}"`
          log.info(`type 'exit' to close sqlcmd and resume `+`sqlpal`.rainbow+` -- or browse to sqlpad for a one-off`)
          break
        default:
          break
      }
      if (sqlArg) {
        config.sqlcmd.switch.U = config.mssql.pool.user
        config.sqlcmd.switch.P = `"${config.mssql.pool.password}"`
        config.sqlcmd.switch.d = `"${config.mssql.pool.database}"`
        Object.keys(config.sqlcmd.switch).forEach((key) => {
            cmdArgs.push(`-${key}`)
            if (config.sqlcmd.switch[key]!=key) {
              cmdArgs.push(config.sqlcmd.switch[key])
            }
        })
        if (typeof args.options.output==='string') {
          cmdArgs.push(`-o "${args.options.output}"`)
        }
        await api.shell(containerId, `${path.resolve(config.odbc.binPath, 'sqlcmd')} ${cmdArgs.join(' ')} ${sqlArg}`)
        callback()
      }
    }
  })

  vorpal.command(`go`, `Execute the Cached tSQL Batch with mssql query mode`.green)
  .action( async (args, callback) => {
    try {
      log.log(api.format(await sqldb.query()))
    }
    catch (err) {
      if (typeof err!='undefined') {
        log.error(err)
      }
    }
    callback()
  })

  vorpal.command(`run`, `Execute the Cached tSQL with mssql batch mode`.green)
  .action( async (args, callback) => {
    log.log(api.format(await sqldb.batch()))
    callback()
  })

  vorpal.command(`test`, `Evaluate the Cached tSQL on the CLI Target with NOEXEC`.green)
  .action( async (args, callback) => {
    log.log(await sqldb.isSQL(api.compile(Batch)))
    callback()
  })

  vorpal.command(`query [queryName]`, `List Stored Queries or overlay Batch Cache with one.`.magenta)
  .action( async (args, callback) => {
    let list=await store.queries.names()
    if (!args.queryName) {
      log.log((list).join('\n'))
      log.info(`Type 'query <exact first letters that uniquely identify the name>' to load one to the Batch`)
    } else {
      let found = list.find((name) => {
        if (name.startsWith(args.queryName)) return name
      })
      store.queries.getBatch(found)
    }
    callback()
  })

  vorpal.command(`script [scriptFile]`, `List '${path.resolve(config.vorpal.cli.scriptPath)}' Scripts or Push Content of One to the Cache`.magenta)
  .action( async (args, callback) => {
    if (!args.scriptFile) {
      log.log(await api.listFiles(path.resolve(config.vorpal.cli.scriptPath), `.sql`))
      log.info('scriptFile autocomplete enabled')
    } else {
      api.fileToBatch(path.resolve(__dirname, config.vorpal.cli.scriptPath, args.scriptFile))
    }
    callback()
  })

  vorpal.command(`errorlog [ext]`, `SQL Server errorlog (no ext for active log file)`.cyan)
  .action( (args, callback) => {
    // show log file (+tail & follow) docker.run stuff default to current
    // file maintenance
    // grep mssqlFiles
    // xp_readerrorlog search
    callback()
  })

  vorpal.command(`files`, `SQL Server File Inspector - Target is default`.cyan)
  .option(`-b, --backups [container-id]`, `SQL Server Database backups files`)
  .option(`-c, --dumps [container-id]`, `SQL Server Core Stack Dump files`)
  .option(`-d, --data [container-id]`, `SQL Server Database Data files`)
  .option(`-l, --log [container-id]`, `SQL Server Database Log files`)
  .action( (args, callback) => {
    api.isDocker()
    .then( (running) => {
      let containerId = typeof args.options[0]!='string'? args.options[0]: api.sqlCatalog.Instance
      if (running && containerId) {
        let folder
        let filter
        switch(true) {
          case (args.options.backups):
            // SELECT TOP (30) bs.machine_name, bs.server_name, bs.database_name AS [Database Name], bs.recovery_model,
            // CONVERT (BIGINT, bs.backup_size / 1048576 ) AS [Uncompressed Backup Size (MB)],
            // CONVERT (BIGINT, bs.compressed_backup_size / 1048576 ) AS [Compressed Backup Size (MB)],
            // CONVERT (NUMERIC (20,2), (CONVERT (FLOAT, bs.backup_size) /
            // CONVERT (FLOAT, bs.compressed_backup_size))) AS [Compression Ratio], bs.has_backup_checksums, bs.is_copy_only, bs.encryptor_type,
            // DATEDIFF (SECOND, bs.backup_start_date, bs.backup_finish_date) AS [Backup Elapsed Time (sec)],
            // bs.backup_finish_date AS [Backup Finish Date], bmf.physical_device_name AS [Backup Location], bmf.physical_block_size
            // FROM msdb.dbo.backupset AS bs WITH (NOLOCK)
            // INNER JOIN msdb.dbo.backupmediafamily AS bmf WITH (NOLOCK)
            // ON bs.media_set_id = bmf.media_set_id
            // WHERE bs.database_name = DB_NAME(DB_ID())
            // AND bs.[type] = 'D' -- Change to L if you want Log backups
            // ORDER BY bs.backup_finish_date DESC OPTION (RECOMPILE);
            folder=path.resolve(config.mssql.backup.path)
            filter=config.mssql.backup.filter
            break
          case (args.options.dumps):
            //SELECT [filename], creation_time, size_in_bytes/1048576.0 AS [Size (MB)]
            //FROM sys.dm_server_memory_dumps WITH (NOLOCK)
            //ORDER BY creation_time DESC OPTION (RECOMPILE);
            folder=path.resolve(config.mssql.dump.path)
            filter=config.mssql.dump.filter
            break
          case (args.options.data):
            // SELECT f.name AS [File Name] , f.physical_name AS [Physical Name],
            // CAST((f.size/128.0) AS DECIMAL(15,2)) AS [Total Size in MB],
            // CAST(f.size/128.0 - CAST(FILEPROPERTY(f.name, 'SpaceUsed') AS int)/128.0 AS DECIMAL(15,2))
            // AS [Available Space In MB], f.[file_id], fg.name AS [Filegroup Name],
            // f.is_percent_growth, f.growth,
            // fg.is_default, fg.is_read_only
            // FROM sys.database_files AS f WITH (NOLOCK)
            // LEFT OUTER JOIN sys.filegroups AS fg WITH (NOLOCK)
            // ON f.data_space_id = fg.data_space_id
            // ORDER BY f.[file_id] OPTION (RECOMPILE);
            folder=path.resolve(config.mssql.data.path)
            filter=config.mssql.data.filter
            break
          case (args.options.log):
            // SELECT DB_NAME(lsu.database_id) AS [Database Name], db.recovery_model_desc AS [Recovery Model],
            // 		CAST(lsu.total_log_size_in_bytes/1048576.0 AS DECIMAL(10, 2)) AS [Total Log Space (MB)],
            // 		CAST(lsu.used_log_space_in_bytes/1048576.0 AS DECIMAL(10, 2)) AS [Used Log Space (MB)],
            // 		CAST(lsu.used_log_space_in_percent AS DECIMAL(10, 2)) AS [Used Log Space %],
            // 		CAST(lsu.log_space_in_bytes_since_last_backup/1048576.0 AS DECIMAL(10, 2)) AS [Used Log Space Since Last Backup (MB)],
            // 		db.log_reuse_wait_desc
            // FROM sys.dm_db_log_space_usage AS lsu WITH (NOLOCK)
            // INNER JOIN sys.databases AS db WITH (NOLOCK)
            // ON lsu.database_id = db.database_id
            // OPTION (RECOMPILE);
            folder=path.resolve(config.mssql.log.path)
            filter=config.mssql.log.filter
            break
          default:
            break
        }
        log.log(api.mssqlFiles(containerId, folder, filter))
      }
    })
    .catch( (err) => {
      api.log('warn', `(command files) error`)
      api.log('error', err.message)
      api.log('debug', err.stack)
    })
    .then( () => {
      callback()
    })
  })

  vorpal.command(`sqlpad`, `Web server for writing and running SQL queries and visualizing the results`.cyan)
  .option(`--start`, `Launch the SQLPad server`)
  .option(`--stop`, `Stop the SQLPad server`)
  .option(`-u, --url`, ``)
  .action( async (args, callback) => {
    switch (true) {
      case (args.options.start):
        api.startSQLPad()
        break
      case (args.options.stop):
        config.sqlpad.sqlpad.kill(1)
        break
      case (args.options.url):
        log.log(`url: https://127.0.0.1:${config.sqlpad["https-port"]}`)
        break
      default:
        log.log(`pid: ${!config.sqlpad.sqlpad? 'none': config.sqlpad.sqlpad.pid}`)
        break
    }
    callback()
  })

  vorpal.command(`use <dbName>`, `Changes CLI Connection Pool Database Context`.red)
  .action( async (args, callback) => {
    log.confirm(await sqldb.openPool(args.dbName))
    callback()
  })

  vorpal.command(`cache`, `Application Cache`.red)
  .alias(`?`)
  .option(`-b, --batch`, `T-SQL Batch Cache Buffer (default)`)
  .option(`-c, --compile <`+`s`.underline+`qlcmd|`+`m`.underline+`ssql>`, `Compile Batch Buffer as if for submit`)
  .option(`-h, --history [begin-timestamp[, end-timestamp]]`, `T-SQL Batch History for this Session`)
  .option(`-m, --map [`+`i`.underline+`p|`+`r`.underline+`eload]`, `Catalog of Hosted SQL Server for Linux Containers`)
  .option(`-n, --new`, `Prepare the T-SQL Batch Array for a new query`)
  .action( (args, callback) => {
      switch(true) {
        case (typeof args.options.compile!='undefined'):
          switch (true) {
            case (/^sq*l*c*m*d*$/i.test(args.options.compile)):
              log.log(`${config.odbc.binPath}/sqlcmd
                ${api.compile(config.sqlcmd.switch)} \n[-i | -q | -Q]\n
                "${api.compile(config.sqlcmd.prefix)} \n${api.compile(Batch)}"`)
              break
            case (/^ms*s*q*l*$/i.test(args.options.compile)):
            default:
              log.log(api.compile(Batch))
              break
          }
          break
        case (args.options.history):
          log.log(api.format(store.batches.list({Date: appStart})))
          break
        case (/^ip*$/i.test(args.options.map)):
          log.log(api.mapPorts())
          break
        case (/^re*l*o*a*d*$/i.test(args.options.map)):
          api.loadCatalog()
          break
        case (args.options.map):
          log.log('api.sqlCatalog.Images'.inverse)
          log.log(api.format(api.listImages()))
          log.log('api.sqlCatalog.ContainerInfos'.inverse)
          log.log(api.format(api.listContainers()))
          log.log(`api.sqlCatalog.Instance`.inverse+` ${api.sqlCatalog.Instance}`)
          break
        case (typeof args.options.key==='timestamp'):
          log.log(store.batches.list({Date: args.options.key}))
          break
        case (typeof args.options.switch==='string'):
          log.log(config.sqlcmd.switch[args.options.switch])
          break
        case (args.options.new):
          Batch.splice(0)
          break
        case (args.options.batch):
        default:
          log.log(api.compile(Batch))
          break
      }
      callback()
  })

  vorpal.command(`about`, `sqlpal`.rainbow+ ` Application Information`.red)
  .option(`-a, --app`, `CLI Commands with all options (self-document)`)
  .option(`-c, --config [edit]`, `View [or open in configured editor] application settings`)
  .option(`-n, --npm`, `Check NPM for package updates of direct descendents`)
  .option(`-p, --package`, `Show the package.json file`)
  .option(`-u, --usage`, `Usage information (aka `+`--HELP`.rainbow+`)`)
  .option(`-v, --version`, `Version (from package.json)`)
  .action( async (args, callback) => {
    switch (true) {
      case (args.options.app):
        let cmds = vorpal.commands
        Object.keys(cmds).forEach( function(i) {
          if (cmds[i]._name.length>0) {
            let results = {}
            results[`${cmds[i]._name}`] = `${cmds[i]._description}`
            if (cmds[i].options.length>0) {
              for (opt in cmds[i].options) {
                results[`  ${cmds[i].options[opt].flags}`] = cmds[i].options[opt].description
              }
            }
            log.log(api.format(results))
          }
        })
        break
      case (/^ed*i*t*$/i.test(args.options.config)):
        await api.editFile(`config.json`)
        break
      case (args.options.config):
        log.log(await api.fileToJSON('config.json'))
        break
      case (['boolean', 'number'].includes(typeof args.options.npm)):
        log.log(await api.checkNPM())
        break
      case (args.options.package):
        log.log(api.format(package))
        break
      case (args.options.version):
        log.log(`node version: ${process.version}`)
        log.log(`sqlpal version: ${package.version}`)
        break
      case (args.options.usage):
        log.log(api.commandAid(vorpal.commands))
        break
      default:
        log.log(api.bandAid)
        log.log(`\t\tsqlpal version: ${package.version}`)
        vorpal.exec(`help about`)
        break
    }
    callback()

  })

  vorpal.catch('[tsql...]')
  .description(api.commandAid(vorpal.commands)) // --HELP
  .action( (args, callback) => {
    log.debug(`(CLI.catch) args:\n ${api.format(args)}`)
    store.lines.getLast()
    .then( (last) => {
      return last.line
    })
    .then( async (line) => {
      if (line.length>0) {
        Batch.push(line)
      }
      callback()
    })

  })

//v don't need pem })
