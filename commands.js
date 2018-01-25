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

  // no deletes, just upserts - so no-op with unknown fixed cost most of the time
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
  vorpal.command(`engine`, `Host Docker Engine Administration (requires root access on host)`)
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

  vorpal.command(`image`, `SQL Server for Linux Docker Image Administration`)
  .option(`-a, --all`, `List local Images`)
  .option(`-f, --full [image-id]`, `Show a ${sqlName} Image Object - default is Target\'s Image`)
  .option(`-i, --id`, `Show Id of Targeted Instance\'s Image`)
  .option(`-p, --pull`, `Fetch latest SQL Server's Image in the dockerhub.com repository`)
  .option(`-r, --run <image-id>`, `Create a New Container using an Image in the Catalog`)
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
          log.log(args)
          log.log(args.options.run)
            log.log(await api.runImage(args.options.run))
            break
          case (args.options.run):
            log.log(await api.runImage())
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

  vorpal.command(`instance`, `SQL Server for Linux Docker Container Administration`)
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
          log.log(api.getContainerInfo(containerId))
          log.log('api.sqlCatalog.Image'.inverse)
          log.log(api.getImage(api.getContainerInfo(containerId).ImageID))
          break
        case ("last"):
          log.log(api.format(await api.latestContainers(args.options.last)))
          break
        case ("remove"):
          log.log(api.format(await api.removeContainer(args.options.remove)))
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

  vorpal.command(`files`, `SQL Server File Inspector`)
  .option(`-b, --backups`, `SQL Server Database backups files`)
  .option(`-c, --dumps`, `SQL Server Core Stack Dump files`)
  .option(`-d, --data`, `SQL Server Database Data files`)
  .option(`-l, --log`, `SQL Server Database Log files`)
  .action( (args, callback) => {
    api.isDocker()
    .then( (running) => {
      let containerId = api.sqlCatalog.Instance
      if (running && containerId) {
        let folder
        let filter
        switch(true) {
          case (args.options.backups):
            folder=path.resolve(config.mssql.backup.path)
            filter=config.mssql.backup.filter
            break
          case (args.options.dumps):
            folder=path.resolve(config.mssql.dump.path)
            filter=config.mssql.dump.filter
            break
          case (args.options.data):
            folder=path.resolve(config.mssql.data.path)
            filter=config.mssql.data.filter
            break
          case (args.options.log):
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

  vorpal.command(`cache`, `Batch Cache Buffer Inspector`)
  .alias(`?`)
  .option(`-b, --batch`, `T-SQL Batch Cache Buffer (default)`)
  .option(`-c, --compile <`+`s`.underline+`qlcmd|`+`m`.underline+`ssql>`, `Compile Batch Buffer as if for submit`)
  .option(`-k, --key [begin-timestamp[, end-timestamp]]`, `T-SQL Batch History for this Session`)
  .option(`-m, --map [`+`r`.underline+`eload]`, `Catalog of Hosted SQL Server for Linux Containers`)
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
        case (args.options.key):
          log.log(api.format(store.batches.list({Date: appStart})))
          break
        case (/^re*l*o*a*d*$/i.test(args.options.map)):
          api.loadCatalog()
          break
        case (args.options.map):
          log.log('api.sqlCatalog.Images'.inverse)
          log.log(api.listImages())
          log.log('api.sqlCatalog.ContainerInfos'.inverse)
          log.log(api.listContainers())
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

  vorpal.command(`bcp [options]`, `Bulk Copy Data in or out using mssql-tools ODBC port`)
  // .option(`-i, --input [data-file| T-SQL | TABLE | VIEW ]`, `source of data`)
  // .option(`-o, --output [data-file]`, `result output file (default stdout)`)
  .action( (args, callback) => {
    log.log(api.bandAid)
    log.debug(`sorry, nothing here. Exit and at bash prompt use the host\'s BCP in /mssql-tools,
      or use the BCP included in the Target SQL Server container (sqlpal command: 'instance --bash')`)
    callback()
  })

  vorpal.command(`bulk <table>`, `Bulk Insert data using mssql bulk mode`)
  // .option(`-i, --input [data-file| T-SQL | TABLE | VIEW ]`, `source of data`)
  // .option(`-o, --output [data-file]`, `result output file (default stdout)`)
  .action( (args, callback) => {
    log.log(api.bandAid)
    log.debug(`sorry, nothing here. Exit and at bash prompt use the host\'s BCP in /mssql-tools,
      or use the BCP included in the Target SQL Server container (sqlpal command: 'instance --bash')`)
    callback()
  })

  vorpal.command(`sqlcmd`, `Process a cached batch or file script via ODBC using sqlcmd`)
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

  vorpal.command(`errorlog [ext]`, `SQL Server errorlog (no extention for active file)`)
  .action( (args, callback) => {
    // show log file (+tail & follow) docker.run stuff default to current
    // file maintenance
    // grep mssqlFiles
    callback()
  })

  vorpal.command(`about`, `sqlpal`.rainbow+ ` Application Information`)
  .option(`-a, --app`, `CLI Commands with all options (self-document)`)
  .option(`-c, --config [edit]`, `Configured start-up default values`)
  .option(`-n, --npm`, `Check NPM for application package updates`)
  .option(`-p, --package`, `package.json`)
  .option(`-u, --usage`, `usage information (aka `+`--HELP`.rainbow+`)`)
  .option(`-v, --version`, `version`)
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

  vorpal.command(`use <dbName>`, `Changes CLI Connection Pool Database Context`)
  .action( async (args, callback) => {
    log.confirm(await sqldb.openPool(args.dbName))
    callback()
  })

  vorpal.command(`go`, `Execute the Cached tSQL with mssql query mode`)
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

  vorpal.command(`run`, `Execute the Cached tSQL with mssql batch mode`)
  .action( async (args, callback) => {
    log.log(api.format(await sqldb.batch()))
    callback()
  })

  vorpal.command(`test`, `Evaluate the Cached tSQL on the CLI Target with NOEXEC`)
  .action( async (args, callback) => {
    log.log(await sqldb.isSQL(api.compile(Batch)))
    callback()
  })

  vorpal.command(`query [queryName]`, `List Stored Queries or overlay Batch Cache with one.`)
  .autocompletion((text) => {
    api.log(`text ${text}`)
    store.queries.names()
    then( (queries) => {
      for (let queryName in queries) {
api.log(`query ${query}`)
        if (query.startsWith(text)) {
api.log(`match!`)
          return queryName
        }
      }
    })
  })
  .action( async (args, callback) => {
    if (!args.queryName) {
      // todo!! autocomplete and multi-column, ditto scripts
      log.log(await store.queries.names())
      log.info('queryName autocomplete is not right yet')
    } else {
      log.log(api.format(store.queries.get(args.queryName)))
    }
    callback()
  })

  vorpal.command(`script [scriptFile]`, `List '${path.resolve(config.vorpal.cli.scriptPath)}' Scripts or Push Content of One to the Cache`)
  .action( async (args, callback) => {
    if (!args.scriptFile) {
      log.log(await api.listFiles(path.resolve(config.vorpal.cli.scriptPath), `.sql`))
      log.info('scriptFile autocomplete enabled')
    } else {
      api.fileToBatch(path.resolve(__dirname, config.vorpal.cli.scriptPath, args.scriptFile))
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
