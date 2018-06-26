//// NPM
const chalk = require('chalk')
const Vorpal = require('vorpal')
const vorpalLog = require('vorpal-log')
//// core
const path = require('path')
//// local
const config = require(`../config/config`)
const {name, version}  = require('../package')
const sqldb = require('../lib/sqldb')
const api = require('./api')
const store = require('./store')

const sqlName=chalk.italic(`SQL Server for Linux`)
let appStart = new Date()

const vorpal = new Vorpal()
  vorpal
  .use(vorpalLog, {printDate: config.vorpal.printDate})
  .delimiter(chalk.dim(`${config.vorpal.port}>`))
  .show()

  vorpal.logger.setFilter(config.vorpal.loglevel)
  let log = vorpal.logger
  api.logger=log

  // socket.io-client errors
  vorpal.on('client_error', (err) => {
    log.warn(chalk.magenta(`[CLI error]`))
    log.error(err.message)
    log.debug(err.stack)
    store.errors.put(err)
  })

  vorpal.on('client_prompt_submit', (data) => {
    if (data!='') { // ignore empty lines
      api.log('debug', chalk.magenta(`[vorpal client_prompt_submit] ${api.format(data)}`))
      store.lines.put(data)
    }
  })

  vorpal.on('client_command_error', (err) => {
    log.warn(chalk.magenta(`[CLI command error]`))
    store.errors.put(err)
  })

  vorpal.command(`about [topic]`, chalk`About ${name} Topics: {italic.bold cli, npm, quickstart, readme, version (default)}`)
  .autocomplete(['cli', 'npm', 'quickstart', 'readme', 'version'])
  .option(`--edit`, `Edit the ./README.md file in ${config.cli.editor}`)
  .option(chalk`--update`, `Apply NPM package updates`)
  .action( async (args) => {
    if (args.options.update) {
      log.log(await api.updateNPM())
    }
    if (args.options.edit) {
      await api.editFile('README.md')
    }
    switch (args.topic) {
      case ('cli'):
        log.log(api.format(api.commandAid(vorpal.commands)))
        break
      case ('npm'):
        log.log(await api.checkNPM())
        break
      case ('quickstart'):
        log.log(api.format(api.cliAid()))
        break
      case ('readme'):
        log.log(await api.fileToJSON('README.md'))
        break
      case ('version'):
      default:
        log.log(api.bandAid)
        break
    }
  })

  vorpal.command(`batch`, `Buffered Query Input `)
  .option(`-e, --edit`, `Edit Buffer Array with '${config.cli.editor}'`)
  .option(`-m, --mssql`, `Compile as if for mssql submit - TSQL Batch (default)`)
  .option(`-r, --reset`, `Remove all text from current Batch buffer - prepare for new query`)
  .option(`-s, --sqlcmd`, `Compile as if for sqlcmd submit - command switches, prefix and TSQL Batch `)
  .action( async (args) => {
      switch(true) {
        case (args.options.sqlcmd):
// prebatch
          log.log(`${config.cli.odbc.path}/sqlcmd
            ${api.compile(config.sqlcmd.switch)} \n[-i | -q | -Q]\n
            "${api.compile(config.sqlcmd.prefix)} \n${api.compile()}"`)
          break
        case (args.options.edit):
          api.batch = (await api.editText(api.compile())).split('\n')
          break
        case (args.options.reset):
          api.batch.splice(0)
          log.log('batch is reset')
          break
        case (args.options.mssql):
        default:
          log.log(api.compile())
          break
      }
  })

  // vorpal.command(`bcp [options]`, `Bulk Copy Data in or out of Target using BCP from mssql-tools`)
  // // .option(`-i, --input [data-file| T-SQL | TABLE | VIEW ]`, `source of data`)
  // // .option(`-o, --output [data-file]`, `result output file (default stdout)`)
  // .action( (args, callback) => {
  //   log.warn(`sorry, nothing here (yet?). Exit and at bash prompt use the host\'s BCP in /mssql-tools,
  //     or use the BCP included in the Target SQL Server container (${name} command: 'container --bash')`)
  //   log.log(api.bandAid)
  //   callback()
  // })

  // vorpal.command(`bulk <table>`, `Bulk Insert using mssql.bulk()`)
  // .action( (args, callback) => {
//need to define arg as table - !!!better yet TVP (recordset.toTable())
  // Arguments
  //     table - sql.Table instance.
  //     callback(err, rowCount) - A callback which is called after bulk insert has completed, or an error has occurred. Optional. If omitted, returns Promise.
  //    example:
  //   // const table = new sql.Table('table_name') // or temporary table, e.g. #temptable
  //   // table.create = true
  //   // table.columns.add('a', sql.Int, {nullable: true, primary: true})
  //   // table.columns.add('b', sql.VarChar(50), {nullable: false})
  //   // table.rows.add(777, 'test')
  //   //
  //   // const request = new sql.Request()
  //   // request.bulk(table, (err, result) => {
  //   //     // ... error checks
  //   // })
  //   callback()
  // })
  // IMPORTANT: Always indicate whether the column is nullable or not!
  //
  // TIP: If you set table.create to true, module will check if the table exists before it start sending data. If it doesn't, it will automatically create it. You can specify primary key columns by setting primary: true to column's options. Primary key constraint on multiple columns is supported.
  //
  // TIP: You can also create Table variable from any recordset with recordset.toTable().

  // show log file (+tail & follow) docker.run stuff default to current
  // delete log file
  // grep mssqlFiles
  // xp_readerrorlog search

  vorpal.command(`catalog`, `Local ${sqlName} Docker Metadata`)
  .option(`-a, --all`, `verbose catalog view`)
  .option(`-c, --container [container-id]`, `Target [or container-id] catalog ContainerInfo`, () => {
    let ids = []
    for (let info of api.sqlCatalog.ContainerInfos) { ids.push(info[0])}
    return ids
  })
  .option(`-i, --image [image-id]`, `Target [or image-id] catalog Image`, () => {
    let ids = []
    for (let image of api.sqlCatalog.Images) { ids.push(image[0])}
    return ids
  })
  .option(`-l, --list`, `brief catalog view (default)`)
  .option(`-n, --networks`, `Host ports and bridged IP addresses of all Containers`)
  .option(`-p, --pool [container-id]`, `Existing Target [or container-id] Connection Pool`, () => {
    let ids = []
    for (let info of api.sqlCatalog.ContainerInfos) { ids.push(info[0])}
    return ids
  })
  .option(`-r, --remap`, `Refresh the map to reflect current Docker state`)
  .action( async (args) => {
    if (await api.isDocker()) {
      switch(true) {
        case (args.options.all):
          log.log(chalk`{inverse api.sqlCatalog.Images}`)
          log.log(api.format(api.listImage()))
          log.log(chalk`{inverse api.sqlCatalog.ContainerInfos}`)
          log.log(api.format(api.listInstance()))
          log.log(chalk`{inverse api.sqlCatalog.Pools}`)
          log.log(api.format(api.listPool()))
          log.log(chalk`{inverse.cyan api.sqlCatalog.Instance} ${api.sqlCatalog.Instance}`)
          break
        case (typeof args.options.container==='string'):
          log.log(api.format(api.listInstance(args.options.container)))
          break
        case (args.options.container):
          log.log(chalk`{inverse api.sqlCatalog.ContainerInfos}`)
          log.log(api.format(api.listInstance()))
          break
        case (typeof args.options.image==='string'):
          log.log(api.format(api.listInstance(args.options.image)))
        case (args.options.image):
          log.log(chalk`{inverse api.sqlCatalog.Images}`)
          log.log(api.format(api.listImage()))
          break
        case (args.options.networks):
          log.log(api.getAddress())
          break
        case (typeof args.options.pool==='string'):
          log.log(api.listPool(containerId))
          break
        case (args.options.pool):
          log.log(api.listPool())
          break
        case (args.options.remap):
          await api.intern()
          break
        case (args.options.list):
        default:
          log.log(chalk.inverse(`api.sqlCatalog.Images`.padStart(30)))
          for (let image of api.sqlCatalog.Images.values()) {
            log.log(chalk.gray(`${image.Id}`)+` (v.${image.Labels["com.microsoft.version"]}) ${image.RepoTags? image.RepoTags[0]: ""}`)
          }
          log.log(chalk.inverse(`api.sqlCatalog.ContainerInfos`.padStart(30)))
          let status
          for (let info of api.sqlCatalog.ContainerInfos.values()) {
            status = info.State!='running'? chalk.red(info.Status): chalk.green(info.Status)
            log.log(chalk.cyan(`${info.Id}`)+` (v.${info.Labels["com.microsoft.version"]}) ${status}`)
          }
          log.log(chalk.inverse(`api.sqlCatalog.Pools`.padStart(30)))
          for (let [instanceId, pool] of api.sqlCatalog.Pools) {
            log.log(`${instanceId} using ${pool.database} as ${pool.user} on port ${pool.port}`)
          }
          log.log(`${chalk.inverse.cyan('api.sqlCatalog.Instance'.padStart(30))} ${chalk.cyan(api.sqlCatalog.Instance)}`)
          break
      }
    }
  })

  vorpal.command(`certificate`, `Self-signing Certificate Authority (uses sudo on '${process.env.HOST}')`)
  .autocomplete( async () => {
    let names = (await api.elevate(`sudo ls private/ -I *-cert.pem -I *.csr -I *.srl`))
    return names.split(' ')
  })
  .option('-a, --all', `All files in volume 'private'`)
  .option('--ca', `Initialize Self-signing CA in volume 'private' and local CA`)
  .option('-c, --certs', `Certifictates in volume 'private' (default: all '-cert.pem' files)`)
  .option('-k, --keys', `Private Keys in volume 'private' (all '-key.pem' files)`)
  .option('--mssql', `Create a cert for mssql connections (client sourced creds)`)
  .option('--new <name>', chalk`Create private key ({italic name}-key.pem) then a CA signed Certificate from that key ({italic name}-cert.pem)`)
  .option('--register <containerId>', `Register the self-signed CA in a SQL Server\'s Ubuntu Container`,  () => {
    let ids = []
    for (let info of api.sqlCatalog.ContainerInfos) {
      if (info[1].State==='running') {
        ids.push(info[0])
      }
    }
    return ids
  })
  .option('--sqlserver', `Generate an SSL query connection cert for SQL Server (server sourced creds)`)
  .option('--sqlpad', `Generate an SSL cert for the sqlpad web server`)
  .action( async function(args){ // no arrow functions if you want to use the _this_ CommandInstance
    let self = this
    switch(true) {
      case (args.options.all):
        await api.elevate(`sudo ls -l private/`)
        break
      case (args.options.ca):
        await api.genCA()
        break
      case (args.options.keys):
        await api.elevate(`sudo ls private/ -l -I *-cert.pem -I *.csr -I *.srl`)
        break
      case (args.options.mssql):
        return this.prompt({
          type: `password`,
          name: `mssql`,
          default: false,
          message: chalk`{bold.italic mssql} connection TLS private key secret `
        }, async function(result){
          await api.genCertificate('mssql', result.mssql)
        })
        break
      case (typeof args.options.new=='string'):
        // openssl dialog will offer .cnf, passphrase will prompt, reprompt, then required for cert gen
        return this.prompt({
          type: `password`,
          name: args.options.new,
          default: false,
          message: chalk`{bold.italic ${args.options.new}} private key secret `
        }, async function(result){
          await api.genCertificate(args.options.new, result[args.options.new])
        })
        break
      case (args.options.sqlserver):
        return this.prompt({
          type: `password`,
          name: `sqlserver`,
          default: false,
          message: chalk`{bold.italic SQL Server} TLS private key secret `
        }, async function(result){
          await api.genCertificate('sqlserver', result.sqlserver)
        })
        break
      case (args.options.sqlpad):
        return this.prompt({
          type: `password`,
          name: `sqlpad`,
          default: false,
          message: chalk`{bold.italic SQLPad} htp TLS private key secret `
        }, async (secret) => {
api.log('confirm', `(sqlpad command) secret`)
api.log('confirm', secret)
          await api.genCertificate('sqlpad', secret)
        })
        break
      case (args.options.certs):
      default:
        await api.elevate(`sudo ls private/ -l -I *-key.pem -I *.csr -I *.srl`)
        break

    }
  })


  //TODO autocomplete conf
  vorpal.command(`configuration`, `Configuration Settings`)
  .option(`-e, --edit`, `Edit 'config.json' file with '${config.cli.ide}'`)
  .option(chalk`-m, --mssqlconf [mssql-conf-key[value] | {underline f}ile]`, `Target Container\'s mssql-conf.py utility or mssql.conf out file`)
  .action( async (args) => {
    let warn = ''
    switch(true) {
      case (args.options.edit):
        await api.editFile(`config/config.json`)
        break
      case (args.options.app===true):
        log.log(await api.fileToJSON('config/config.json'))
        break
// appears this might actually work this way if right python is on board (using mssql-conf.py) ???
      case (/^fi*l*e*$/i.test(args.options.mssqlconf)):
        if (await api.isDocker() && api.sqlCatalog.Instance) {
          api.shell(api.sqlCatalog.Instance, `cat ${path.resolve(config.mssql.bin.path, 'mssql.conf')}`)
        }
        break
      case (typeof args.options.mssqlconf==='string'):
        if (await api.isDocker() && api.sqlCatalog.Instance) {
          let argpair = await store.lines.getLast()
          await api.mssqlConf(api.sqlCatalog.Instance, argpair.line.split(' ').slice(2).join(' '))
        }
        break
      case (args.options.mssqlconf===true):
        if (await api.isDocker() && api.sqlCatalog.Instance) {
          await api.mssqlConf(api.sqlCatalog.Instance, '-h')
        }
        break
// end of mssql-conf.py stuff
      case (args.options.current):
      default:
        log.log(config)
        break
    }
  })

  vorpal.command(`container [container-id]`, `${sqlName} Docker Containers - default id is current Target`)
  .autocomplete(() => {
    let ids = []
    for (let info of api.sqlCatalog.ContainerInfos) {
      if (info[1].State==='running') {
        ids.push(chalk.green(info[0]))
      } else {
        ids.push(chalk.red(info[0]))
      }
    }
    return ids
  })
  .option(chalk`-a, --all`, `All SQL Server Containers (same as)`)
  .option(`-b, --bash`, `bash shell in Container`)
  .option(chalk`-c, --connection [state-change]`, `See [or Set] Connection Pool State of Target SQL Instance`, ['close', 'open'])
  .option(`-e, --entity`, `See Container\'s docker+node API Entity Object`)
  .option(`-f, --full`, `See Container\'s definition`)
  .option(chalk`-l, --last [{italic n}]`, `See Last n (default 3) SQL Containers Created`)
  .option(`-n, --name`, `name or rename a container`)
  .option(`--remove`, chalk`Remove Container ({yellow data may be lost - backup first!})`)
  .option(`--restart`, `Restart Container if 'running' (recommended)`)
  .option(`--sqlstart`, chalk`Start SQL Server process in container ({italic.bold --start} {yellow is preferred})`)
  .option(`--sqlstop`, chalk`Stop SQL Server process leaving container running ({italic.bold --stop} {yellow is preferred})`)
  .option(`--start`, `Start Container if not already 'running' (recommended)`)
  .option(`--stop`, `Stop Container (recommended)`)
  .option(`-t, --target`, `Set as CLI Target Container`)
  .action( async (args) => {
    let containerId
    if (!args["container-id"]) {
      containerId = api.sqlCatalog.Instance
    } else if (api.sqlCatalog.ContainerInfos.has(args["container-id"])) {
      containerId = args["container-id"]
    }
    if (await api.isDocker()) {
      switch(true) {
        case (args.options.all):
          log.log(api.format(api.listInstances()))
          break
        case (args.options.bash):
          api.interactiveShell(containerId)
          break
        case (args.options.connection):
            if (/^cl*o*s*e*$/i.test(args.options.connection)) {
              log.log(await sqldb.closePool())
            } else if (/^op*e*n*$/i.test(args.options.connection)) {
              log.log(await sqldb.openPool(containerId))
            } else {
              log.log(`connection pool: ${sqldb.state()}`)
            }
          break
        case (args.options.entity):
          log.log(api.format(api.getInstanceInfo(containerId)))
          break
        case (args.options.full):
          log.log(chalk.inverse('api.sqlCatalog.ContainerInfo'))
          log.log(api.format(api.getInstanceInfo(containerId)))
          log.log(chalk.inverse('api.sqlCatalog.Image'))
          log.log(api.format(await api.getImage(api.getInstanceInfo(containerId).ImageID)))
          break
        case (args.options.last):
          log.log(api.format(await api.latestInstances(containerId)))
          break
        case (args.options.name):
          await api.nameInstance(containerId)
          await api.intern()
          break
        case (args.options.remove):
          if (api.getInstanceInfo(containerId).State!='running') { // was using args.options.remove
            log.log(api.format(await api.removeInstance(containerId)))
          } else {
            log.warn(chalk`{yellow Stop Container Before Removing} {italic.bold container [container-id] --stop}`)
          }
          await api.intern()
          break
        case (args.options.restart):
          await api.restartInstance(containerId)
          break
        case (args.options.sqlstart):
          await api.startSQLServer(containerId)
          break
        case (args.options.sqlstop):
          await api.stopSQLServer(containerId)
          break
        case (args.options.start):
          await api.startInstance(containerId)
          break
        case (args.options.stop):
          await api.stopInstance(containerId)
          break
        case (args.options.target):
          if (containerId && containerId!=api.sqlCatalog.Instance) {
            await api.intern(containerId)
          }
          break
        default:
          log.log(`Target Container: ${api.sqlCatalog.Instance}`)
          break
      }
    }
  })

  vorpal.command(`engine`, `Host Docker Engine Administration (requires root on '${process.env.HOST}')`)
  .option(`-?, --status`, `Report on Current Status default`)
  .option(`--start`, `Start Container Engine`)
  .option(`--stop`, `Stop Container Engine`)
  .action( async (args) => {
    switch(Object.keys(args.options)[0]) {
      case ("start"):
      case ("stop"):
      case ("status"):
        await api.setEngine(Object.keys(args.options)[0])
        break
      default:
        break
    }
  })

  vorpal.command(`file [container-id]`, `SQL Server Files in Container`)
  .autocomplete(() => {
    let ids = []
    for (let info of api.sqlCatalog.ContainerInfos) {
      if (info[1].State==='running') {
        ids.push(info[0])
      }
    }
    return ids
  })
  .option(`-a, --agent`, `SQL Agent Logs`)
  .option(`-b, --backups`, `Database Backups (shared Docker Volume)`)
  .option(`-c, --dumps`, `Stack Dumps`)
  .option(`-d, --data`, `Database Data`)
  .option(`-e, --errorlog`, `SQL Server Output Log`)
  .option(`-l, --log`, `Database Log`)
  .option(`-p, --private`, `Private Credentials (shared Docker Volume)`)
  .action( async (args) => {
    if (await api.isDocker()) {
      let folder, filter
      let containerId = typeof args.options[Object.keys(args.options)[0]]==='string'?args.options[Object.keys(args.options)[0]]: api.sqlCatalog.Instance
      if (api.sqlCatalog.ContainerInfos.has(containerId) &&
          api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
        switch(true) {
          case (args.options.agent):
            folder=config.mssql.env[`MSSQL_ERRORLOG_DIR`]
            filter='sqlagent'
            break
          case (args.options.backups):
            folder=config.mssql.env[`MSSQL_BACKUP_DIR`]
            filter='.bak'
            break
          case (args.options.dumps):
            folder=config.mssql.env[`MSSQL_DUMP_DIR`]
            filter='core'
            break
          case (args.options.data):
            folder=config.mssql.env[`MSSQL_DATA_DIR`]
            filter='.mdf'
            break
          case (args.options.errorlog):
            folder=config.mssql.env[`MSSQL_ERRORLOG_DIR`]
            filter='errorlog'
            break
          case (args.options.log):
            folder=config.mssql.env[`MSSQL_LOG_DIR`]
            filter=`.ldf`
            break
          case (args.options.private):
            folder=config.mssql.env[`MSSQL_PRIVATE_DIR`]
            filter=`.pem`
            break
          default:
            folder='$MSSQL_ERRORLOG_DIR'
            break
        }
        await api.mssqlFiles(containerId, folder, filter)
      }
    }
  })

  vorpal.command('go', `Submit the Batch to the Pool Target using mssql.Request.query`)
  .action( async (args, callback) => {
    try {
      if (await api.isDocker()) {
        let results = await sqldb.query()
        log.log(api.format(results))
      }
    }
    catch (err) {
      if (typeof err!='undefined') {
        log.error(err)
      }
    }
    finally {
      callback()
    }
  })

  vorpal.command(`history <collection>`, chalk`Search nedb logged CLI history`)
  .autocomplete( () => { return Object.keys(store)})
  .option('-l, --limit [limitNumber]', `default is 8`)
  .option('-k, --skip [skipNumber]', `default is 0`)
  .option('-p, --projection [projectionJSON]', `default is {}`)
  .option('-q, --query [queryJSON]', `default is {}`)
  .option('-s, --sort [sortJSON]', `default is {}`)
  .action( async (args) => {
    log.log(api.format(await store.search(args)))
  })

  vorpal.command(`image`, `${sqlName} Docker Images`)
  .option(`-a, --all`, `Images in Host\'s Catalog`)
  .option(`-f, --full [image-id]`, `Show a Hosted ${sqlName} Docker Image (Target\'s image if no id entered)`, () => {
    let ids = []
    for (let image of api.sqlCatalog.Images) { ids.push(image[0])}
    return ids
  })
  .option(`-i, --id`, `Show Id of Target Container\'s Image`)
  .option(`--pull`, `Fetch '${config.docker.pull.repo}:latest' from the Dockerhub Repository`)
  .option(`--run <image-id>`, `Instantiate New Container`, () => {
    let ids = []
    for (let image of api.sqlCatalog.Images) { ids.push(image[0])}
    return ids
  })
  .action( async (args) => {
    if (await api.isDocker()) {
      switch (true) {
        case (args.options.all):
          log.log(api.format(api.listImage()))
          break
        case (typeof args.options.full==='string'):
          log.log(api.format(await api.getImage(args.options.full)))
          break
        case (args.options.full):
          log.log(api.format(await api.getImage()))
          break
        case (args.options.id):
          api.sqlCatalog.ContainerInfo.get(api.sqlCatalog.Instance).ImageID
          break
        case (args.options.pull):
          log.log(await api.pullImage())
          break
        case (typeof args.options.run===`string`):
          await api.runImage(args.options.run)
          await api.intern()
          break
        case (args.options.run):
          log.log(await api.runImage())
          await api.intern()
          break
        default:
          if (!imageId && api.sqlCatalog.Instance) {
            imageId=api.getInstanceInfo().ImageID
          }
          log.log(`Target Image: ${imageId}`)
          break
      }
    }
  })

  vorpal.command(`issql`, chalk`Evaluate Batch as tSQL on Target - uses {italic SET NOEXEC ON} {yellow objects are not verified}`)
  .action( async (args) => {
    if (await api.isDocker()) {
      if (await sqldb.isSQL(api.compile())) {
        log.confirm(`OK`)
      }
    }
  })

  // timestamps in logs comes from SQL Server - no on/off --timestamps
  vorpal.command(`log [containerId]`, `Container Log`)
  .option('-f, --follow', `Follow log output (running containers only)`)
  .option('-s, --since', `Show logs since timestamp (e.g. 2013-01-02T13:23:37) or relative (e.g. 42m for 42 minutes)`)
  .option('-t, --tail', `Number of lines to show from the end of the logs (default "all")`)
  .autocomplete(() => {
    let ids = []
    for (let info of api.sqlCatalog.ContainerInfos) {
      if (info[1].State==='running') {
        if (api.sqlCatalog.Instance===info[0]) {
          ids.push(chalk.green.bold(info[0]))
        } else {
          ids.push(chalk.green(info[0]))
        }
      } else {
        if (api.sqlCatalog.Instance===info[0]) {
          ids.push(chalk.red.bold(info[0]))
        } else {
          ids.push(chalk.red(info[0]))
        }
      }
    }
    return ids
  })
  .action( async (args) => {

    let containerId = args.containerId || api.sqlCatalog.Instance
    if (await api.isDocker() && api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
      await api.tailLog(containerId, false)
    }

  })

  vorpal.command(`query [queryName]`, `Queries in ${name}\'s nedb data store`)
  .autocomplete( async () => {
    let queries = []
    for (let name of await store.queries.names()) {
      queries.push(name)
    }
    return queries
  })
  .option(`--delete`, `Remove query from the store (omit queryName to remove all)`)
  .option(`-e, --edit `, `Open the named stored query in '${config.cli.editor}' (omit queryName to edit 'queries.js' source file)`)
  .option(`-f, --full`, `List query text now in the query store (omit queryName for all)`)
  .option(`--import`, chalk`upsert local query store from './queries.js' souce file ({italic.yellow previous query edits will be lost})`)
  .option(`-l, --load`, `load a query by name from store into Batch - awaiting user Termination to Target (default)`)
  .option(`--sync`, chalk`Overwrite './queries.js' source file from query store`)
  .action( async (args) => {
    let available=await store.queries.names()
    switch(true) {
      case (args.options.delete):
        for (let name of avaliable) {
          if (!queryName || queryName===name) {
            store.queries.remove(name)
          }
        }
        break
      case (args.options.edit):
        if (!args.queryName) {
          store.queries.import(await api.editFile(path.resolve(`lib/queries.js`)))
        } else {
          for (let name of available) {
            if (name.startsWith(args.queryName)) {
              let text = await api.editText(store.queries.get(name))
              store.queries.upsert(args.queryName, text)
              break
            }
          }
        }
        break
      case (args.options.full):
        for (let name of available) {
          if (!args.queryName || name.startsWith(args[queryName])) {
            log.log(`\n-- query ${name}`)
            log.log(api.format(store.queries.get(name)))
          }
        }
        break
      case (args.options.import):
        store.queries.import()
        break
      case (args.options.load):
      default:
        if (!args.queryName) {
          log.log('\n  Queries:\n')
          log.log('    '+available.join('\n    '))
          log.confirm(`Query Name Autocomplete enabled`)
        } else {
          let found = available.find((name) => {
            if (name.startsWith(args.queryName)) return name
          })
          store.queries.getBatch(found)
        }
        break
    }
  })

  vorpal.command(`run`, `Submit Batch to Target using mssql.Request.batch()`)
  .option(chalk`-s, --showplan [{underline A}LL|{underline T}EXT|{underline X}ML]`,
    chalk`Wrap in {bold.italic SET SHOWPLAN_ALL|TEXT|XML ON/OFF}`)
  .option(chalk`-t, --statistics [{underline I}O|{underline P}ROFILE|{underline T}IME|{underline X}ML]`,
    chalk`Wrap in with {bold.italic SET STATISTICS IO|PROFILE|XML ON/OFF} statement to batch`)
  .action( async (args) => {
    let stmt
    if (await api.isDocker()) {
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
    }
  })

  vorpal.command(`script [fileName]`, `T-SQL script files in ${path.resolve(config.cli.script.path)}`)
  .autocomplete( async () => {
    let scripts = []
    for (let name of await api.listFiles(path.resolve(config.cli.script.path), config.cli.script.filter)) {
      scripts.push(name.replace(config.cli.script.filter, ``))
    }
    return scripts
  })
  .option(`-a, --add`, `Create new script file using '${config.cli.editor}'`)
  .option(`-d, --develop `, `Edit script file using '${config.cli.ide}'`)
  .option(`-e, --edit `, chalk`Edit script file using '${config.cli.editor}' (import instead & use {italic.bold cache --edit} to edit query but not file)`)
  .option(`-i, --import`, chalk`Load a script file into the Batch - awaiting user Termination (default when is fileName)`)
  .option(`-l, --list`, `List scripts in the script folder by name (default when no fileName)`)
  .action( async (args) => {
    try {
      switch (true) {
        case (args.options.add):
          if (args.fileName) {
            await api.addFile(path.resolve(config.cli.script.path, args.fileName+config.cli.script.filter))
          }
          break
        case (args.options.develop):
          if (args.fileName) {
            await api.developFile(path.resolve(config.cli.script.path, args.fileName+config.cli.script.filter))
          }
          break
        case (args.options.edit):
          if (args.fileName) {
            await api.editFile(path.resolve(config.cli.script.path, args.fileName+config.cli.script.filter))
          }
          break
        case (args.options.import):
          await api.fileToBatch(path.resolve(config.cli.script.path, args.fileName+config.cli.script.filter))
          break
        case (args.options.list):
        default:
          if (!args.fileName) {
            log.log('\n  Scripts:\n')
            for (let script of await api.listFiles(path.resolve(config.cli.script.path), config.cli.script.filter)) {
                log.log('    ' + script.replace(config.cli.script.filter, ''))
            }
            log.confirm(`Script FileName Autocomplete enabled`)
          } else {
            await api.fileToBatch(path.resolve(config.cli.script.path, args.fileName+config.cli.script.filter))
          }
          break
      }
    }
    catch(err) {
      log.warn(`(command script) error`)
      log.error(err.message)
      log.debug(err.stack)
    }
  })


// needs to be able to run on host or in container
  vorpal.command(`sqlcmd`, `Process a cached batch or file script on Target using SQLCMD`)
  .option(chalk`-b, --batch [{underline e}dit]`, `Inspect/Edit SET Statement(s) executed before prefixed batch`)
  .option(`-e, --execsql`, chalk`Wrap batch in sp_executesql (prefix executes {italic before} wrapped batch)`)
  .option(`-i, --input <script-file>`, `process a T-SQL script file - ignoring the batch`)
  .option(`-Q, --Query`, `Process the prebatched and prefixed batch and exit, rendering JSON results`)
  .option(chalk`-p, --prefix [{underline e}dit]`, `Inspect/Edit SET Statement(s) prefixed to all queries`)
  .option(`-q, --query`, `Process the prefixed batch rendering tabular results and remain in sqlcmd`)
  .option(`-o, --output <data-file>`, `write result to the file - one of flag [e, i, Q or q] also required`)
  .option(chalk`-s, --switch [switch-flag]|[{underline e}dit]`, `Inspect/Edit Command-line switch defaults`)
  .action( async (args) => {
    if (await api.isDocker()) {
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
          case (/^ed*i*t*$/i.test(args.options.prebatch)):
            this.log(await api.editBuffer(config.sqlcmd.prebatch))
          case (args.options.prebatch):
            result=config.sqlcmd.prebatch
            break
          case (/^ed*i*t*$/i.test(args.options.prefix)):
            this.log(await api.editBuffer(config.sqlcmd.prefix))
          case (args.options.prefix):
            result=config.sqlcmd.prefix
            break
          case (/^ed*i*t*$/i.test(args.options.switch)):
            this.log(await api.editBuffer(config.sqlcmd.switch))
          case (args.options.switch):
            result=config.sqlcmd.switch
            break
          case (args.options.Query):
            sqlArg=`-Q "${api.compile(config.sqlcmd.prebatch)} GO ${api.compile(config.sqlcmd.prefix)} ${api.compile()}"`
            usingBatch=true
            break
          case (args.options.query):
            sqlArg=`-q "${api.compile(config.sqlcmd.prebatch)} GO ${api.compile(config.sqlcmd.prefix)} ${api.compile()}"`
            this.info(`type 'exit' to close sqlcmd and resume ${name} CLI`)
            usingBatch=true
            break
          default:
            sqlArg=''
            await api.shell(containerId, `${path.resolve(config.cli.odbc.path, 'sqlcmd -?')}`)
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
          await api.shell(containerId, `${path.resolve(config.cli.odbc.path, 'sqlcmd')} ${cmdArgs.join(' ')} ${sqlArg}`)
          if (usingBatch) {
            api.batch.splice(0)
          }
        }
      }
    }
  })

  vorpal.command(`sqlpad`, `Web server for writing and running SQL queries and visualizing the results`)
  .option(`--start`, `Launch SQLPad web server`)
  .option(`--stop`, `Stop SQLPad web server`)
  .option(`-u, --url`, ``)
  .action( async function(args) {
    let self=this
    switch (true) {
      case (args.options.start):
        return this.prompt({
          type: `password`,
          name: `sqlpad`,
          default: false,
          message: `{bold.italic SQLPad} client connections TLS private key secret `
        }, async function(secret){
          await api.startSQLPad(secret.sqlpad)
        })
        break
      case (args.options.stop):
        api.sqlpad.kill(1)
        break
      case (args.options.url):
        if (!config.sqlpad["sqlpad"]) {
          this.log(chalk`web server not detected, try {italic sqlpad --start}`)
        } else {
          this.log(`url: https://127.0.0.1:${config.sqlpad["https-port"]}`)
        }
        break
      default:
        this.log(`pid: ${!config.sqlpad["sqlpad"]? 'none': config.sqlpad.sqlpad.pid}`)
        break
    }
  })

  vorpal.command(`use <dbName>`, `CLI Database Context - change Connection Pool database`)
  .autocomplete( async () => {
    let databases = []
    let results = await sqldb.query('select name from sysdatabases')
    for (let db of results.recordset) {
       databases.push(db.name)
     }
    return databases
  })
  .action( async (args) => {
    if (sqldb.state==='connected') {
      config.mssql.pool.database = args.dbName
    }
  })

  vorpal.catch('[tsql...]')
  .description(api.commandAid(vorpal.commands)) // --HELP
  .action( async (args, callback) => {
    api.batch.push((await store.lines.getLast()).line)
    callback()
  })
