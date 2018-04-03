//// NPM
const chalk = require('chalk')
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

const sqlName=chalk.italic(`SQL Server for Linux`)
let appStart = new Date()

const vorpal = new Vorpal()
  vorpal
    .use( vorpalLog, { printDate: config.printDate } )
    .delimiter( chalk.dim(`${config.vorpal.port}>`) )
    .show()

  vorpal.logger.setFilter(config.vorpal.loglevel)
  let log = vorpal.logger
  log.log(api.bandAid)
  config.log=log

  // no deletes, just upserts - so will no-op with unknown fixed (small I bet) cost most of the time
  store.queries.import()

  // Maps to error for socket.io-client
  vorpal.on('client_error', (err) => {
    log.warn(chalk.magenta(`[CLI error]`))
    log.error(err.message)
    log.debug(err.stack)
    store.errors.put(err)
  })

  vorpal.on('client_prompt_submit', (data) => {
    if (data!='') { // ignore empty lines
      log.debug(chalk.magenta(`[vorpal client_prompt_submit] ${api.format(data)}`))
      store.lines.put(data)
    }
  })

  vorpal.on('client_command_error', (err) => {
    log.warn(chalk.magenta(`[CLI command error]`))
    log.error(err)
    store.errors.put(err)
  })

  vorpal.on('client_command_executed', (data) => {
   log.debug(chalk.magenta(`[vorpal client_command_executed]\n${api.format(data)}`))
   store.commands.put(data)   // using client_prompt_submit instead for logging
  })

  // could easily be modified or cloned to use su or sudo for elevation
  vorpal.command(`engine`, chalk.blue(`Host Docker Engine Administration (requires root access on '${process.env.HOST}')`))
  .option(`-s, --status`, `Report on Current Status default`)
  .option(`--start`, `Start Container Engine`)
  .option(`--stop`, `Stop Container Engine`)
  .action( (args, callback) => {
    switch(Object.keys(args.options)[0]) {
      case ("start"):
      case ("stop"):
        api.setEngine(Object.keys(args.options)[0])
        api.intern()
        break
      case ("status"):
      default:
        api.setEngine(Object.keys(args.options)[0])
        break
    }
    callback()
  })

  vorpal.command(`image`, chalk.blue(`SQL Server for Linux Docker Images`))
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
        imageId=api.getInstanceInfo().ImageID
      }
      if (running) {
        switch (true) {
          case (args.options.all):
            log.log(api.format(api.listImages()))
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
            await api.intern()
            break
          case (args.options.run):
            log.log(await api.runImage())
            await api.intern()
            break
          default:
            log.log(`Target Image: ${imageId}`)
            break
        }
      }
      callback(log.log(api.bandAid))
    })
    .catch( (err) => {
      api.log('warn', `(command image) error`)
      api.log('error', err)
    })
    .then( () => {
      callback()
    })
  })

  vorpal.command(`instance`, chalk.blue(`SQL Server for Linux Docker Containers`))
  .alias('~')
  .option(chalk`-a, --all`, `Local SQL Server Containers`)
  .option(`-b, --bash [container-id]`, `Open Interactive bash shell in a Cataloged Container`)
  .option(chalk`-c, --connection [{underline O}PEN|{underline C}LOSE]`, `See [or Set] Connection Pool State of Target SQL Instance`)
  .option(`-e, --entity [container-id]`, `See Container\'s docker+node API Entity Object`)
  .option(`-f, --full [container-id]`, `See Container\'s definition`)
  .option(`-l, --last [{italic n}]`, `See Last n (default 3) SQL Containers Created`)
  .option(`--remove <container-id>`, `Remove a Container - container-id mandatory (did you backup?)`)
  .option(`--restart [container-id]`, `Restart a Container - only if 'running', default is Target`)
  .option(`--start [container-id]`, `Start a Container - if not already 'running', default is Target`)
  .option(`--stop [container-id]`, `Stop a Container - default is Target`)
  .option(`-t, --target [container-id]`, `See [or Set] CLI Target Container`)
  .action( async (args, callback) => {
    let containerId, targetId
    if (await api.isDocker()) {
      if (typeof args.options[Object.keys(args.options)[0]]==='string' &&
        api.sqlCatalog.ContainerInfos.has(args.options[Object.keys(args.options)[0]])) {
          containerId=args.options[Object.keys(args.options)[0]]
      } else if (typeof args.options[Object.keys(args.options)[0]]==='boolean') {
        containerId=api.sqlCatalog.Instance
      }
      switch(Object.keys(args.options)[0]) {
        case ("all"):
          log.log(api.format(api.listInstances()))
          break
        case ("bash"):
          api.interactiveShell(containerId)
          break
        case ("connection"):
            if (/^cl*o*s*e*$/i.test(args.options.connection)) {
              log.log(await sqldb.closePool())
            } else if (/^op*e*n*$/i.test(args.options.connection)) {
              log.log(await sqldb.openPool(containerId))
            } else {
              log.log(`connection pool: ${sqldb.state()}`)
            }
          break
        case ("entity"):
          log.log(api.format(api.getInstanceInfo(containerId)))
          break
        case ("full"):
          log.log(chalk.inverse('api.sqlCatalog.ContainerInfo'))
          log.log(api.format(api.getInstanceInfo(containerId)))
          log.log(chalk.inverse('api.sqlCatalog.Image'))
          log.log(api.format(await api.getImage(api.getInstanceInfo(containerId).ImageID)))
          break
        case ("last"):
          log.log(api.format(await api.latestInstances(containerId)))
          break
        case ("remove"):
          if (api.getInstanceInfo(containerId).State!='running') { // was using args.options.remove
            log.log(api.format(await api.removeInstance(containerId)))
          } else {
            log.warn(`Container must be stopped before it can be removed`)
          }
          await api.intern(containerId)
          break
        case ("restart"):
          await api.restartInstance(containerId)
          break
        case ("start"):
          await api.startInstance(containerId)
          break
        case ("stop"):
          await api.stopInstance(containerId)
          break
        case ("target"):
          if (containerId && containerId!=api.sqlCatalog.Instance) {
            await api.intern(containerId)
          }
        default:
          log.log(`Target Container: ${api.sqlCatalog.Instance}`)
          break
      }
    }
    callback(log.log(api.bandAid))

  })

  vorpal.command(`config`, chalk.red(`Component Configurations.`))
  .option(`-a, --app [edit]`, `sqlpal 'config.json' file`)
  .option(chalk`-m, --mssqlconf [mssql-conf-args...]|[{underline F}ILE]`, `Target Container\'s mssql-conf.py utility or mssql.conf out file`)
  .option(`-s, --sqlserver [option-name]`, `sys.configurations (edit with EXEC sp_configure(option-name, new-value))`)
  .action( async (args, callback) => {
    let containerId
    if (await api.isDocker()) {
      containerId=api.sqlCatalog.Instance
      switch(true) {
        case (/^ed*i*t*$/i.test(args.options.app)):
          await api.editFile(`config.json`)
          break
        case (args.options.app===true):
          log.log(await api.fileToJSON('config.json'))
          break
        case (/^fi*l*e*$/i.test(args.options.mssqlconf)):
          if (containerId) {
            api.shell(containerId, `cat ${path.resolve(config.mssql.binPath, 'mssql.conf')}`)
          }
          break
        case (typeof args.options.mssqlconf==='string'):
          if (containerId) {
            let doc = await store.lines.getLast()
            await api.mssqlConf(containerId, doc.line.split(' ').slice(2).join(' '))
          }
          break
        case (args.options.mssqlconf===true):
          if (containerId) {
            await api.mssqlConf(containerId, '-h')
          }
          break
        case (typeof args.options.sqlserver==='string'):
          if (containerId) {
            let doc = await store.lines.getLast()
            await sqldb.query(`EXEC sp_configure '${doc.line.split(' ').slice(2).join(' ')}'`)
          }
          break
        case (args.options.sqlserver===true):
          if (targetId) {
            await sqldb.query(await store.queries.get(`configurations`))
          }
          break
        default:
          break
      }
    }
    callback(log.log(api.bandAid))

  })

  vorpal.command(`bcp [options]`, chalk.yellow(`Bulk Copy Data in or out of Target using BCP from mssql-tools`))
  // .option(`-i, --input [data-file| T-SQL | TABLE | VIEW ]`, `source of data`)
  // .option(`-o, --output [data-file]`, `result output file (default stdout)`)
  .action( (args, callback) => {
    log.log(api.bandAid)
    log.debug(`sorry, nothing here. Exit and at bash prompt use the host\'s BCP in /mssql-tools,
      or use the BCP included in the Target SQL Server container (sqlpal command: 'instance --bash')`)
    callback()
  })

  vorpal.command(`bulk <table>`, chalk.yellow(`Bulk Insert data using mssql.bulk()`))
  // .option(`-i, --input [data-file| T-SQL | TABLE | VIEW ]`, `source of data`)
  // .option(`-o, --output [data-file]`, `result output file (default stdout)`)
  .action( (args, callback) => {
    log.log(api.bandAid)
    log.debug(`sorry, nothing here. Exit and at bash prompt use the host\'s BCP in /mssql-tools,
      or use the BCP included in the Target SQL Server container (sqlpal command: 'instance --bash')`)
    callback()
  })

  vorpal.command(`sqlcmd`, chalk.green(`Process a cached batch or file script on Target using SQLCMD`))
  .option(`-e, --execsql`, chalk`Process batch via sp_executesql, {italic after} the prefix executes`)
  .option(`-i, --input <script-file>`, `process a T-SQL script file rather than the batch`)
  .option(`-Q, --Query`, `Process the prefixed batch and exit, rendering JSON results`)
  .option(chalk`-p, --prefix [{underline e}dit]`, `Inspect/Edit SET Statement(s) prefixed to all queries`)
  .option(`-q, --query`, `Process the prefixed batch in sqlcmd, rendering tabular results`)
  .option(`-o, --output <data-file>`, `write result to the file - one of flag [e, i, Q or q] also required`)
  .option(chalk`-s, --switch [switch-flag]|[{underline e}dit]`, `Inspect/Edit Command-line switch defaults`)
  .action( async (args, callback) => {
    // different containerId could be used behind -H switch, what happens then?
    let containerId = api.sqlCatalog.Instance
    if (containerId) {
      let cmdArgs = []
      let sqlArg = ''
      let usingBatch = false
      switch(true) {
        case (args.options.execsql):
          sqlArg=`-Q "${api.compile(config.sqlcmd.prefix)} exec sp_executesq('${api.compile()}')"`
          usingBatch=true
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
          sqlArg=`-Q "${api.compile(config.sqlcmd.prefix)} ${api.compile()}"`
          usingBatch=true
          break
        case (args.options.query):
          sqlArg=`-q "${api.compile(config.sqlcmd.prefix)} ${api.compile()}"`
          log.info(`type 'exit' to close sqlcmd and resume sqlpal CLI`)
          usingBatch=true
          break
        default:
          sqlArg=''
          await api.shell(containerId, `${path.resolve(config.odbc.binPath, 'sqlcmd -?')}`)
          callback()
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
        if (usingBatch) {
          api.batch.splice(0)
        }
        callback()
      }
    }
  })

  vorpal.command('go', chalk.green(`Send the Batch to the Pool Target using mssql.Request.query() and await the results`))
  .action( async (args, callback) => {
    try {
      let results = await sqldb.query()
      log.log(api.format(results))
    }
    catch (err) {
      if (typeof err!='undefined') {
        log.error(err)
      }
    }
    callback()
  })

  vorpal.command(`run`, chalk.green(`Send the Batch to the Pool Target using mssql.Request.batch() and await the results`))
  .option(chalk`-s, --showplan [{underline A}LL|{underline T}EXT|{underline X}ML]`, chalk`Append {italic SET SHOWPLAN_ALL|TEXT|XML ON}`)
  .option(chalk`-t, --statistics [{underline I}O|{underline P}ROFILE|{underline T}IME|{underline X}ML]`, chalk`Prepend {italic SET STATISTICS IO ON} statement to batch`)
  .action( async (args, callback) => {
    let stmt
    switch (true) {
      case (/^al*l*$/i.test(args.options.showplan)):
        stmt='SHOWPLAN_ALL'
        break
      case (/^te*x*t*$/i.test(args.options.showplan)):
        stmt='SHOWPLAN_TEXT'
        break
      case (/^xm*l*$/i.test(args.options.showplan)):
        stmt='SHOWPLAN_XML'
        break
      case (/^io*$/i.test(args.options.statistics)):
        stmt=`STATISTICS IO`
        break
      case (/^pr*o*f*i*l*e*$/i.test(args.options.statistics)):
        stmt=`STATISTICS PROFILE`
        break
      case (/^ti*m*e*$/i.test(args.options.statistics)):
        stmt=`STATISTICS TIME`
        break
      case (/^xm*l*$/i.test(args.options.statistics)):
        stmt=`STATISTICS XML`
        break
      default:
        break
      }
      if (stmt) {
        api.batch.unshift(`SET ${stmt} ON`, `GO`)
        api.batch.push(`GO`, `SET ${stmt} OFF`)
      }
      let results = await sqldb.batch()
      log.log(api.format(results))
      callback()
    })

  vorpal.command(`issql`, chalk`{green Non-destructive Evaluation of Batch as tSQL on the CLI Target - uses} {italic SET NOEXEC ON}`)
  .action( async (args, callback) => {
    if (await sqldb.isSQL(api.compile())) {
      log.confirm(chalk`Accepted as tSQL by Target SQL Server {yellow (objects not verified)}`)
    }
    callback()
  })

  vorpal.command(`query [queryName]`, chalk.magenta(`Load a local nedb stored query - omit queryName to list available`))
  .action( async (args, callback) => {
    let list=await store.queries.names()
    if (!args.queryName) {
      log.log((list).join('\n'))
      log.info(`Type 'query <exact first letters that uniquely identify the name>' to load specified to the batch`)
    } else {
      let found = list.find((name) => {
        if (name.startsWith(args.queryName)) return name
      })
      store.queries.getBatch(found)
    }
    callback()
  })

  vorpal.command(`script [fileName]`, chalk.magenta(`Load a local '.sql' script file - omit fileName to list available`))
  .action( async (args, callback) => {
    try {
      if (!args.scriptFile) {
        for (let script of await api.listFiles(path.resolve(config.vorpal.cli.scriptPath), `.sql`)) {
          log.log(script.replace('.sql', ''))
        }
      } else {
        await api.fileToBatch(path.resolve(__dirname, config.vorpal.cli.scriptPath, args.fileNmae+`.sql`))
      }
    }
    catch(err) {
      log.warn(`script files error`)
      log.error(err.message)
      log.debug(err.stack)
    }
    finally {
      callback()
    }
  })

  vorpal.command(`errorlog [ext]`, chalk.cyan(`SQL Server errorlog (no ext for active log file)`))
  .action( (args, callback) => {
    // show log file (+tail & follow) docker.run stuff default to current
    // file maintenance
    // grep mssqlFiles
    // xp_readerrorlog search
    callback()
  })

  vorpal.command(`files [container-id]`, chalk.cyan(`SQL Server File Collections (defaults to target)`))
  .option(`-b, --backups [filename]`, `SQL Server Database backups files`)
  .option(`-c, --dumps [filename]`, `SQL Server Core Stack Dump files`)
  .option(`-d, --data [filename]`, `SQL Server Database Data files`)
  .option(`-l, --log [filename]`, `SQL Server Database Log files`)
  .action( (args, callback) => {
    api.isDocker()
    .then( async (running) => {
      let containerId = typeof args.options[Object.keys(args.options)[0]]==='string'?args.options[Object.keys(args.options)[0]]: api.sqlCatalog.Instance
      if (running && containerId) {
        let folder, filter
        switch(true) {
          case (args.options.backups):
            folder=path.resolve(config.mssql.backup.path)
            filter=config.mssql.backup.filter
            break
          case (typeof args.options.backups==='string'):
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
        await api.mssqlFiles(containerId, folder, filter)
        callback()
      }
    })
    .catch( (err) => {
      log.warn(`(command files) error`)
      log.error(err.message)
      log.debug(err.stack)
    })
    // .then( () => {
      // callback()
    // })
  })

  vorpal.command(`sqlpad`, chalk.cyan(`Web server for writing and running SQL queries and visualizing the results`))
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
        if (!config.sqlpad["sqlpad"]) {
          log.log(chalk`web server not detected, try {italic sqlpad --start}`)
        } else {
          log.log(`url: https://127.0.0.1:${config.sqlpad["https-port"]}`)
        }
        break
      default:
        log.log(`pid: ${!config.sqlpad["sqlpad"]? 'none': config.sqlpad.sqlpad.pid}`)
        break
    }
    callback()
  })

  vorpal.command(`use <dbName>`, chalk.red(`CLI Database Context - changes Connection Pool, UPPERCASE 'USE' affects this query only`))
  .action( async (args, callback) => {
    config.mssql.pool.database = args.dbName
    callback()
  })

  vorpal.command(`cache`, chalk.red(`Non-persistent CLI details`))
  .alias(`?`)
  .option(`-b, --batch`, `T-SQL Batch Cache Buffer (default)`)
  .option(chalk`-c, --compile <{underline s}qlcmd|{underline m}ssql>`, chalk`Compile Batch Buffer {gray (as if for submit)}`)
  .option(chalk`-m, --map [{underline i}p|{underline r}emap]`, `Local Catalog of SQL Server for Linux Containers`)
  .option(`-r, --reset`, `Remove all text from active Batch, as for a new query`)
  .action( (args, callback) => {
      switch(true) {
        case (typeof args.options.compile!='undefined'):
          switch (true) {
            case (/^sq*l*c*m*d*$/i.test(args.options.compile)):
              log.log(`${config.odbc.binPath}/sqlcmd
                ${api.compile(config.sqlcmd.switch)} \n[-i | -q | -Q]\n
                "${api.compile(config.sqlcmd.prefix)} \n${api.compile()}"`)
              break
            case (/^ms*s*q*l*$/i.test(args.options.compile)):
            default:
              log.log(api.compile())
              break
          }
          break
        case (/^ip*$/i.test(args.options.map)):
          log.log(api.getPorts())
          break
        case (/^re*m*a*p*$/i.test(args.options.map)):
          api.intern()
          break
        case (args.options.map):
          log.log(chalk`{inverse api.sqlCatalog.Images}`)
          log.log(api.format(api.listImages()))
          log.log(chalk`{inverse api.sqlCatalog.ContainerInfos}`)
          log.log(api.format(api.listInstances()))
          log.log(chalk`{inverse api.sqlCatalog.Pools}`)
          log.log(api.format(api.listPools()))
          log.log(chalk`{inverse api.sqlCatalog.Instance}\n\t${api.sqlCatalog.Instance}`)
          break
        case (typeof args.options.key==='timestamp'):
          log.log(store.batches.list({Date: args.options.key}))
          break
        case (typeof args.options.switch==='string'):
          log.log(config.sqlcmd.switch[args.options.switch])
          break
        case (args.options.reset):
          api.batch.splice(0)
          break
        case (args.options.batch):
        default:
          log.log(api.compile())
          break
      }
      callback()
  })

  vorpal.command(`history [query-json] [projection-json] [sort-json] [limit-nbr]`, chalk.red(`Persistent CLI Details [default limit-nbr is 8 rows]`))
  .option(`-b, --batches`, `Batches submitted`)
  .option(`-c, --commands`, `Command lines entered`)
  .option(`-e, --errors`, `Errors caught`)
  .option(`-r, --configs`, `sqlpal Configuration snapshots`)
  .option(`-l, --lines`, `how is this different than commands + batches????`)
  .option(`-n, --npm`, `NPM dependecy version checks`)
  .option(`-p, --pulls`, `Dockerhub downloads`)
  .option(`-t, --templates`, `queries`)
  .action( async (args, callback) => {
    let query = args["query-json"] || {}
    let projection = args["projection-json"] || {}
    let sort = args["sort-json"] || {}
    let limit = args["limit-nbr"] || 0
    switch(true) {
      case (args.options.batches):
        log.log(api.format(await store.batches.list(query, projection, sort, limit)))
        break
      case (args.options.commands):
        log.log(api.format(await store.commands.list(query, projection, sort, limit)))
        break
      case (args.options.configs):
        log.log(api.format(await store.configs.list(query, projection, sort, limit)))
        break
      case (args.options.errors):
        log.log(api.format(await store.errors.list(query, projection, sort, limit)))
        break
      case (args.options.lines):
        log.log(api.format(await store.lines.list(query, projection, sort, limit)))
        break
      case (args.options.npm):
        log.log(api.format(await store.npm.list(query, projection, sort, limit)))
        break
      case (args.options.pulls):
        log.log(api.format(await store.pulls.list(query, projection, sort, limit)))
        break
      case (args.options.templates):
        log.log(api.format(await store.templates.list(query, projection, sort, limit)))
        break
      default:
        log.log('resent lines entered')
        log.log(await store.lines.list({}, {_id: 0, line: 1, createdAt: 1}, {createdAt: -1}, 8))
        break
    }
    callback()
  })

  vorpal.command(`about`, chalk.red(`About sqlpal - with helper options`))
  .option(chalk`-c, --config [{underline E}DIT]`, `View [or open in configured editor] application settings`)
  .option(`-d, --dependencies`, `sqlpal ./package.json dependencies)`)
  .option(`-n, --npm`, `Check NPM for updates to sqlpal and all ./package.json dependencies)`)
  .option(`-q, --quickstart`, `Show quickstart usage message`)
  .option(`-r, --readme`, `Show the ./README.md file`)
  .option(`-v, --version`, `sqlpal Version (from ./package.json)`)
  .action( async (args, callback) => {
    switch (true) {
      case (args.options.npm):
        log.log(await api.checkNPM())
        break
      case (args.options.quickstart):
        log.log(api.format(api.commandAid(vorpal.commands)))
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
        api.batch.push(line)
      }
      callback()
    })

  })
