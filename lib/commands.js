//// NPM
const chalk = require('chalk')
const Vorpal = require('vorpal')
const vorpalLog = require('vorpal-log')
//// core
//const fs = require('fs')
const path = require('path')
//// local
const config = require(`../config.json`)
const package  = require('../package.json')
const sqldb = require('./sqldb')
//const test = require('./test/test')
const api = require('./api')
const store = require('./store')

const sqlName=chalk.italic(`SQL Server for Linux`)
let appStart = new Date()

const vorpal = new Vorpal()
  vorpal
    .use( vorpalLog, { printDate: config.vorpal.printDate } )
    .delimiter( chalk.dim(`${config.vorpal.port}>`) )
    .show()

  vorpal.logger.setFilter(config.vorpal.loglevel)
  let log = vorpal.logger
  api.logger=log

  // Maps to error for socket.io-client
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
    log.error(err)
    store.errors.put(err)
  })

  // orchestrated vorpal.exec() only, in a commandInstance the line is always captured too so this is redundant
  // vorpal.on('client_command_executed', (data) => {
  //  log.debug(chalk.magenta(`[vorpal client_command_executed]\n${api.format(data)}`))
  // })

  vorpal.command(`about [topic]`, chalk`About ${package.name} Topics: {italic.bold cli, npm, quickstart, readme, version}`)
  .autocomplete(['cli', 'npm', 'quickstart', 'readme', 'version'])
  .option(`-e, --edit`, `Edit the ./README.md file in ${config.cli.editor}`)
  .option(chalk`-u, --update`, `Apply NPM package updates`)
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
        log.log(api.format(api.dockerAid()))
        break
      case ('readme'):
        await api.fileToJSON('README.md')
        break
      case ('version'):
      default:
        log.log(chalk`\n\t{bold ${package.name}}\n\t  version: {bold.italic ${package.version}}`)
        log.log(api.bandAid)
        break
    }
  })

  vorpal.command(`batch`, `Buffered Input caught by CLI Linereader`)
  .alias(`?`)
  .option(`-b, --batch`, `Current Batch (default)`)
  .option(chalk`-c, --compile <{underline s}qlcmd|{underline m}ssql>`, chalk`Compile Batch Buffer {gray (as if for submit)}`)
  .option(`-e, --edit`, `Edit Current Batch`)
  .option(`-x, --reset`, `Remove all text from current Batch buffer - prepared for new query`)
  .action( async (args) => {
      switch(true) {
        case (typeof args.options.compile!='undefined'):
          switch (true) {
            case (/^sq*l*c*m*d*$/i.test(args.options.compile)):
              log.log(`${config.cli.odbcPath}/sqlcmd
                ${api.compile(config.sqlcmd.switch)} \n[-i | -q | -Q]\n
                "${api.compile(config.sqlcmd.prefix)} \n${api.compile()}"`)
              break
            case (/^ms*s*q*l*$/i.test(args.options.compile)):
            default:
              log.log(api.compile())
              break
          }
          break
        case (args.options.edit):
          api.batch = (await api.editText(api.compile())).split('\n')
          break
        case (args.options.reset):
          api.batch.splice(0)
          break
        case (args.options.batch):
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
  //     or use the BCP included in the Target SQL Server container (${package.name} command: 'instance --bash')`)
  //   log.log(api.bandAid)
  //   callback()
  // })

  // vorpal.command(`bulk <table>`, `Bulk Insert (mssql.bulk())`)
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

  vorpal.command(`catalog`, `Local SQL Server for Linux Docker Stuff`)
  .alias('map')
  .option(chalk`-a, --all`, `verbose catalog view`)
  .option(chalk`-c, --container [container-id]`, `Target [or another] catalog ContainerInfo`)
  .option(chalk`-i, --image [image-id]`, `Target [or another] catalog Image`)
  .option(chalk`-n, --networks`, `Host ports and bridged IP addresses of all Containers`)
  .option(chalk`-p, --pool [container-id]`, `Connection Pools created in this ${package.name} session`)
  .option(chalk`-r, --remap`, `Refresh the map to reflect current Docker state`)
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
          api.intern()
          break
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

  vorpal.command(`certificate`, `OpenSSL Certificates and Self-signed CA`)
  .option('--ls [filter]', `Files in folder '${config.cli.certPath}'`)
  .option('--ca', `Self-signing Certificate Authority`)
  .option('--new <name>', `CA signed Certificate`)
  .action( async (args) => {
    switch(true) {
      case (args.options.ca):
        await api.genCA()
        break
      case (typeof args.options.new=='string'):
        await api.genCertificate(args.options.new)
        break
      case (args.options.ls):
      default:
        await api.listFiles(config.cli.certPath, (typeof args.options.ls==='string')?args.options.ls: '')
        break
    }
  })

// ???emacs diff the file and the runtime???
  vorpal.command(`config`, `Configuration Settings (default shows app runtime)`)
  .option(chalk`-a, --app [{underline e}dit|{underline r}untime]`, `${package.name} 'config.json' file (option default shows file)`)
  .option('-e, --environment', `Target Container\'s Environment Variables`)
  .option(chalk`-m, --mssqlconf [mssql-conf-key[value]]|[{underline f}ile]`, `Target Container\'s mssql-conf.py utility or mssql.conf out file`)
  .action( async (args) => {
    switch(true) {
      case (/^ed*i*t*$/i.test(args.options.app)):
        await api.editFile(`config.json`)
        break
      case (/^ru*n*t*i*m*e*$/i.test(args.options.app)):
        log.log(config)
        break
      case (args.options.app===true):
        log.log(await api.fileToJSON('config.json'))
        break
      case (/^fi*l*e*$/i.test(args.options.mssqlconf)):
        if (await api.isDocker() && api.sqlCatalog.Instance) {
          api.shell(api.sqlCatalog.Instance, `cat ${path.resolve(config.mssql.binPath, 'mssql.conf')}`)
        }
        break
      case (typeof args.options.mssqlconf==='string'):
        if (await api.isDocker() && api.sqlCatalog.Instance) {
          let doc = await store.lines.getLast()
          await api.mssqlConf(api.sqlCatalog.Instance, doc.line.split(' ').slice(2).join(' '))
        }
        break
      case (args.options.mssqlconf===true):
        if (await api.isDocker() && api.sqlCatalog.Instance) {
          await api.mssqlConf(api.sqlCatalog.Instance, '-h')
        }
        break
      default:
        api.log('log', config)
        break
    }
  })

  // could easily be modified or cloned to use su or sudo for elevation
  vorpal.command(`engine`, `Host Docker Engine Administration (requires root access on '${process.env.HOST}')`)
  .option(`-s, --status`, `Report on Current Status default`)
  .option(`--start`, `Start Container Engine`)
  .option(`--stop`, `Stop Container Engine`)
  .action( (args) => {
    switch(Object.keys(args.options)[0]) {
      case ("start"):
      case ("stop"):
        api.setEngine(Object.keys(args.options)[0])
        // api.intern() map reflects current docker api obj
        break
      case ("status"):
      default:
        api.setEngine(Object.keys(args.options)[0])
        break
    }
  })

  vorpal.command(`file [container-id]`, `SQL Server Files in Container`)
  .alias('files')
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
            folder=path.resolve(config.mssql.agent.path)
            filter=config.mssql.agent.filter
            break
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
          case (args.options.errorlog):
            folder=path.resolve(config.mssql.errorlog.path)
            filter=config.mssql.errorlog.filter
            break
          case (args.options.log):
            folder=path.resolve(config.mssql.log.path)
            filter=config.mssql.log.filter
            break
          case (args.options.private):
            folder=path.resolve(config.mssql.log.path)
            filter=config.mssql.log.filter
            break
          default:
            folder=path.resolve(config.mssql.errorlog.path)
            filter="^-"
            break
        }
        await api.mssqlFiles(containerId, folder, filter)
      }
    }
  })

  vorpal.command('go', `Submit the Batch to the Pool Target using mssql.Request.query*`)
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
  .autocomplete(['batches', 'commands', 'errors', 'config', 'lines', 'npm', 'pulls'])
  .option('-l, --limit [limitNumber]', `default is 8`)
  .option('-k, --skip [skipNumber]', `default is 0`)
  .option('-p, --projection [projectionJSON]', `default is {}`)
  .option('-q, --query [queryJSON]', `default is {}`)
  .option('-s, --sort [sortJSON]', `default is {}`)
  .action( async (args) => {
    log.log(await store.search(args))
  })

  vorpal.command(`image`, `SQL Server for Linux Docker Images`)
  .alias(`images`)
  .option(`-a, --all`, `Images in Host\'s Catalog`)
  .option(`-f, --full [image-id]`, `Show a Hosted ${sqlName} Docker Image (Target\'s image if no id entered)`)
  .option(`-i, --id`, `Show Id of Target Container\'s Image`)
  .option(`--pull`, `Fetch '${config.docker.repo}:latest' from the Dockerhub Repository`)
  .option(`--run <image-id>`, `Create a New Container using an Image from Host\'s Catalog`)
  .action( async (args) => {
    if (await api.isDocker()) {
      let imageId=args.options[0]
      if (!imageId && api.sqlCatalog.Instance) {
        imageId=api.getInstanceInfo().ImageID
      }
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
  })

  vorpal.command(`instance`, `SQL Server for Linux Docker Containers`)
  .alias('~')
  .alias('container')
  .alias('containers')
  .alias('target')
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
  .action( async (args) => {
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
          break
        default:
          log.log(`Target Container: ${api.sqlCatalog.Instance}`)
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

  vorpal.command(`query [queryName]`, `Queries in ${package.name}\'s nedb data store`)
  .option(chalk`--delete`, `Remove query from the store (omit queryName to remove all)`)
  .option(chalk`-e, --edit `, `Open the named stored query in '${config.cli.editor}' (omit queryName to edit 'queries.js' source file)`)
  .option(chalk`-f, --full`, `List query text now in the query store (omit queryName for all)`)
  .option(chalk`--import`, chalk`upsert local query store from './queries.js' souce file ({italic.yellow previous query edits will be lost})`)
  .option(chalk`-l, --load`, `load a query by name from store into Batch - awaiting user Termination to Target (default)`)
  .option(chalk`--sync`, chalk`Overwrite './queries.js' source file from query store`)
  .action( async (args) => {
    let available=await store.queries.names()
    await api.isDocker()
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
          store.queries.import(await api.editFile('queries.js'))
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
        //log.log(api.format(await store.templates.list(query, projection, sort, limit)))
        break
      case (args.options.import):
        // no deletes, just upserts - everything echos to screen when run at load, may not in the CommandInstance???
        store.queries.import()
        break
      case (args.options.load):
      default:
        if (!args.queryName) {
          log.log('\n  Queries:\n')
          log.log('    '+available.join('\n    '))
          log.log(chalk`\n  Type {italic.bold query <enough first letters to uniquely identify query>} to load a query into the batch\n`)
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

  vorpal.command(`script [fileName]`, `T-SQL script files in ${path.resolve(config.cli.scriptPath)}`)
  .alias(`scripts`)
  .autocomplete( async () => {
    let scripts = []
    for (let name of await api.listFiles(path.resolve(config.cli.scriptPath), `.sql`)) {
      scripts.push(name.replace(`.sql`, ``))
    }
    return scripts
  })
  .option(`-a, --add`, `Create new script file using '${config.cli.editor}'`)
  .option(`-d, --develop `, `Open script using '${config.cli.ide}'`)
  .option(`-e, --edit `, `Open script using '${config.cli.editor}'`)
  .option(`-i, --import`, chalk`Load a script file into the Batch - awaiting user Termination to Target (default if fileName)`)
  .option(`-l, --list`, `List scripts in the script folder by name (default when no fileName)`)
  .action( async (args) => {
    try {
      // await api.isDocker()
      // if (!args.fileName) {
      //   log.log(`\n  Files:\n`)
      //   for (let script of await api.listFiles(path.resolve(config.cli.scriptPath), `.sql`)) {
      //     log.log(`    `+script.replace(`.sql`, ``))
      //   }
      //   log.log(chalk`\n  Type {italic.bold script <unique first characters of script name>} to load the script into the batch\n\n`)
      // } else {
        switch (true) {
          case (args.options.add):
            if (args.fileName) {
              await api.addFile(path.resolve(config.cli.scriptPath, args.fileName+`.sql`))
            }
            break
          case (args.options.develop):
            if (args.fileName) {
              await api.developFile(path.resolve(config.cli.scriptPath, args.fileName+`.sql`))
            }
            break
          case (args.options.edit):
            if (args.fileName) {
              await api.editFile(path.resolve(config.cli.scriptPath, args.fileName+`.sql`))
            }
            break
          case (args.options.import):
            await api.fileToBatch(path.resolve(config.cli.scriptPath, args.fileName+`.sql`))
          case (args.options.list):
            for (let script of await api.listFiles(path.resolve(config.cli.scriptPath), `.sql`)) {
              if (!args.fileName || script.match(args.fileName)) {
                log.log(script.replace('.sql', ''))
              }
            }
            break
          default:
            await api.fileToBatch(path.resolve(config.cli.scriptPath, args.fileName+`.sql`))
            break
        }
      // }
    }
    catch(err) {
      log.warn(`(command script) error`)
      log.error(err.message)
      log.debug(err.stack)
    }
  })

  vorpal.command(`sqlcmd`, `Process a cached batch or file script on Target using SQLCMD`)
  .option(`-e, --execsql`, chalk`Process batch via sp_executesql, {italic after} the prefix executes`)
  .option(`-i, --input <script-file>`, `process a T-SQL script file rather than the batch`)
  .option(`-Q, --Query`, `Process the prefixed batch and exit, rendering JSON results`)
  .option(chalk`-p, --prefix [{underline e}dit]`, `Inspect/Edit SET Statement(s) prefixed to all queries`)
  .option(`-q, --query`, `Process the prefixed batch in sqlcmd, rendering tabular results`)
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
            log.info(`type 'exit' to close sqlcmd and resume ${package.name} CLI`)
            usingBatch=true
            break
          default:
            sqlArg=''
            await api.shell(containerId, `${path.resolve(config.cli.odbcPath, 'sqlcmd -?')}`)
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
          await api.shell(containerId, `${path.resolve(config.cli.odbcPath, 'sqlcmd')} ${cmdArgs.join(' ')} ${sqlArg}`)
          if (usingBatch) {
            api.batch.splice(0)
          }
        }
      }
    }
  })

  vorpal.command(`sqlpad`, `Web server for writing and running SQL queries and visualizing the results`)
  .option(`--start`, `Launch the SQLPad server`)
  .option(`--stop`, `Stop the SQLPad server`)
  .option(`-u, --url`, ``)
  .action( async (args) => {
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
  })

  vorpal.command(`use <dbName>`, `CLI Database Context - change Connection Pool database*`)
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
