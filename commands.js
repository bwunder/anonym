const pem = require('pem')
//const Promise = require('bluebird')
const Vantage = require('vantage')
//const watch = require('vantage-watch')
const vorpalLog = require('vorpal-log')

//// core
const fs = require('fs')
const path = require('path')

// need to eliminate
const childProcess = require('child_process')

//// local
const config = require(`./config.json`)
const package  = require('./package.json')
const sqldb = require('./sqldb')
const test = require('./test/test')
const api = require('./api')
const store = require('./store')

const Batch = config.batch

let appStart = new Date()

pem.createCertificate(config.pem, function(err, keys){

  // feed the cert to sqlpad via the file system
  fs.writeFileSync(config.sqlpad[`key-path`], keys.serviceKey)
  fs.writeFileSync(config.sqlpad[`cert-path`], keys.certificate)

  const express = require('express')

  const vantage = new Vantage()
  const app = express()

  vantage
    .use( vorpalLog, { printDate: config.printDate } )
    .banner( api.bandAid )
    .listen(app, {
      port: config.vantage.port,
      ssl: true,
      key: keys.serviceKey,
      cert: keys.certificate,
      requestCert: true,
      rejectUnauthorized: true,
      logActivity: true },
      (socket) => { this.log(`socket connected: ${socket.id}`)
    })
    .delimiter( `${config.vantage.port}`.rainbow+'>' )
    .show()
//    .delimiter( `sql`.rainbow + `pal`.america + `@${config.vantage.port}~` )

  // ??? nothing...
  vantage.auth( config.vantage.middleware, config.vantage.auth )

  vantage.logger.setFilter(config.vantage.loglevel)
  // put the logger where everybody can get to it
  let log = vantage.logger
  log.log(vantage._banner)
  config.log=log

  //VANTAGE FIREWALL (impacts remote Vantage socket connections only)

  // default policy can be /^ACCEPT$/i or /^REJECT$/i
  vantage.firewall.policy(config.vantage.firewall.policy)
  // explict IPv4 rules (e.g., localhost and local subnetting)
  config.vantage.firewall.rules.forEach( function(rule) {
    // validate the rule ip - v4 or v6? https://jsfiddle.net/AJEzQ/
    if ( /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/.test(rule.ip)){
      // build firewall (tested w/IPv4 rules only)
      switch (true) {
        case (/^accept$/i.test(rule.rule)):
          vantage.firewall.accept(`${rule.ip}/${rule.subnet}`)
          break
        case (/^reject$/i.test(rule.rule)):
          vantage.firewall.reject(`${rule.ip}/${rule.subnet}`)
          break
        default:
          log.warn(`ignoring firewall rule:\n\t${JSON.stringify(rule)}`)
          break
      }
    }
  })

  // no deletes, just upserts - so no-op with unknown fixed cost most of the time
  store.queries.import()

  //VANTAGE COMMAND CLI EVENT HANDLERS

  // Maps to error for socket.io-client
  vantage.on('client_error', (err) => {
    log.warn(`[vantage.client_error]`.gray)
    log.error(err.message)
    log.debug(err.stack)
    store.clients.put({ error: err, event: 'client_error' })
  })

  // documented, but never see it fire when looking through the line reader?
  // vantage.on('client_keypress', (data) => {
  //   log.debug(`[vantage client_keypress]\n ${api.format(data)}`.magenta)
  // })

  // Maps to connect_error for socket.io-client
  vantage.on('client_connect_error', (err) => {
    log.warn('debug', `[vantage client_connect_error]`.magenta)
    log.error(err)
    store.clients.put(err, 'client_connect_error')
  })

  // Maps to connect for socket.io-client
  vantage.on('client_connect', (data) => {
    api.log('debug', `[vantage client_connect]\n ${api.format(data)}`.magenta)
    store.clients.put(data, 'client_connect')
  })

  // Maps to disconnect for socket.io-client.
  vantage.on('client_disconnect', (data) => {
    api.log('debug', `[vantage client_disconnect]\n ${api.format(data)}`.magenta)
    store.clients.put(data, 'client_disconnect')
  })

  vantage.on('client_prompt_submit', (data) => {
    if (data!='') { // ignore empty lines
      log.debug(`[vantage client_prompt_submit] ${api.format(data)}`.magenta)
      store.lines.put(data, 'client_prompt_submit')
    }
  })

  vantage.on('client_command_error', (err) => {
    log.warn(`[vantage client_command_error]`.magenta)
    log.error(err)
    store.clients.put(err, 'client_command_error')
  })

  vantage.on('client_command_executed', (data) => {
   // ????? called twice - is it submitted twice - is it vantage bug or did I screw it up ??????
   // using client_prompt_submit instead for logging
   // log.debug(`[vantage client_command_executed]\n${api.format(data)}`.magenta)
  })

  //--VANTAGE SERVER EVENT HANDLERS--

  vantage.on('server_command_error', (err) => {
    // !!!! could just update the client_command_executed or server_command_executed but which doc is that from here?
    api.log('warn', `[vantage server_command_error]`.magenta.inverse)
    api.log('error', err.message.gray)
    api.log('debug', err.stack.gray)
    store.commands.put({event: 'server_command_error', error: err})
  })

  // socket.io connect event
  vantage.on('server_connection', (data) => {
    api.log('debug', `[vantage server_connection]`.magenta.inverse)
    api.log('debug', api.format(data).gray)
    store.clients.put({event: 'server_connection', data})
  })

  // socket.io disconnect event
  vantage.on('server_disconnect', (data) => {
    api.log('debug', `[vantage server_disconnect] ${api.format(data)}`.gray)
    store.clients.put({event: 'server_disconnect', data})
  })

  vantage.on('server_command_executed', (data) => {
    api.log('debug', `[vantage server_command_executed] ${api.format(data)}`.gray)
    store.commands.put({event: 'server_command_executed', data})
  })

  vantage.on('server_command_received', (data) => {
    api.log('debug', `[vantage server_command_received] ${api.format(data)}`.gray)
    // ???? put on _received and update on executed ???
    store.commands.put({event: 'server_command_received', data})
  })

  vantage.command(`config`, `Component Configurations.`)
  .option(`-a, --app [edit]`, `sqlpal 'config.json' file`)
  .option(`-m, --mssql [mssql-conf-args]|[file]`, `Target SQL Server Container\'s mssql-conf utility and settings file`)
  .option(`-s, --sqlserver [option-name]`, `sys.configurations (edit with EXEC sp_configure(option-name, new-value))`)
  .action( (args, callback) => {
    api.isDocker()
    .then( async (running) => {
      let targetId
      if (running) {
        targetId=api.sqlCatalog.Instance
      }
      switch(true) {
        case (/^ed*i*t*$/i.test(args.options.app)):
          await api.editFile(`config.json`)
          break
        case (args.options.app===true):
          log.log(await api.fileToJSON('config.json'))
          break
        case (/^fi*l*e*$/i.test(args.options.mssql)):
          if (targetId) {
            api.shell(containerId, `cat ${path.resolve(config.mssql.confPath, 'mssql.conf')}`)
          }
          break
        case (typeof args.options.mssql==='string'):
          if (targetId) {
            store.lines.getLast()
            .then( (doc) => {
              api.mssqlConf(containerId, doc.line.split(' ').slice(2).join(' '))
            })
            .catch( (err) => {
              api.log('warn', `error opening shell`)
              api.log('error', err.message)
              api.log('debug', err.stack)
            })
            .then( () => {
              callback()
            })
          }
          break
        case (args.options.mssql===true):
          if (targetId) {
            await api.mssqlConf(targetId, '-h')
          }
          break
        case (typeof args.options.sqlserver==='string'):
          // this needs rest of raw line instead, then won't need quotes
          if (targetId) {
            store.lines.getLast()
            .then( (doc) => {
              // use the rest of the line, set will work too if the comma is included
              sqldb.query(`EXEC sp_configure '${doc.line.split(' ').slice(2).join(' ')}'`)
            })
            .catch( (err) => {
              api.log('warn', `(command config --sqlserver) sp_configure() error `)
              api.log('error', err.message)
              api.log('debug', err.stack)
            })
            .then( () => {
              api.log('use sp_configure() at the prompt to edit a configuration')
            })
          }
          break
        case (args.options.sqlserver===true):
          if (targetId) {
            await sqldb.query(await store.queries.get(`configurations`))
          }
          break
        default:
          vantage.exec(`help config`)
          break
      }
    })
    .catch( (err) => {
      api.log('warn', `(command config) error`)
      api.log('error', err.message)
      api.log('debug', err.stack)
    })
    .then( () => {
      callback()
    })
  })

  vantage.command(`engine`, `Local Docker Container Engine (requires host root)`)
  .option(`-c, --status`, `Report on Current Status`)
  .option(`-s, --start`, `Start Container Engine`)
  .option(`-z, --stop`, `Stop Container Engine`)
  .action( (args, callback) => {
    if (Object.keys(args.options).length===1) {
      api.setEngine(Object.keys(args.options)[0])
      if (args.options.start) {
        api.loadCatalog()
      }
      if (args.options.stop) {
        api.loadCatalog()
      }

    }
    callback()
  })

  vantage.command(`image`, `Manage the local SQL Server for Linux Docker Images`)
  .option(`-a, --all`, `List local Images`)
  .option(`-f, --full [image-id]`, `Show the Target SQL Server's Image Object`)
  .option(`-i, --id`, `Show the Targeted Instance\'s container.ImageID`)
  .option(`-p, --pull`, `Check for an updated image in the dockerhub.com repository`)
  .option(`-r, --run <image-id>`, `Create a New Container using an Image in the Catalog`)
  .action( (args, callback) => {
    api.isDocker()
    .then( async (running) => {
      let imageId
      if (running) {
        imageId=api.getContainerInfo().ImageID
      }
      if (running) {
        switch (true) {
          case (args.options.all):
            log.log(api.listImages())
            break
          case (args.options.full):
            log.log(api.format(await api.getImage()))
            break
          case (args.options.id):
            if (!imageId) {
              log.warn(`No Target (set one with 'instance -i <container-name>')`)
            } else {
              log.log(`Image of Target Instance: ${imageId}`)
            }
            break
          case (args.options.pull):
            api.pullImage()
            break
          case (typeof args.options.run===`string`):
            if (api.sqlCatalog.Images.has(args.options.run)) {
              log.warn(`Image not found ${args.options.run}`)
            } else {
              api.runImage(arg.options.run)
            }
            break
          case (args.options.run):
            api.runImage()
            break
          default:
            break
        }
      }
    })
    .catch( (err) => {
      api.log('warn', `(command image) error`)
      api.log('error', err)
    })
    .then( () => {
      callback()
    })
  })

  vantage.command(`instance`, `Work With Catalog of SQL Server for Linux Containers`)
  .option(`-a, --all`, `Review Catalog of local SQL Server Container Definitions`)
  .option(`-b, --bash`, `Open Interactive bash Session in Target\'s Container`)
  .option(`-c, --connection [OPEN|CLOSE]`, `Connection Pool State of Target SQL Server`)
  .option(`-d, --dockerode [container-id]`, `Review Container\'s docker+node API object`)
  .option(`-f, --full [container-id]`, `Review a Container\'s definition from sqlCatalog`)
  .option(`-i, --id [container-id]`, `View/Set ID of CLI\'s Connection Pool Target Container`)
  .option(`-r, --restart [container-id]`, `Restart a 'running' Container (reuse the open pool)`)
  .option(`-s, --start [container-id]`, `Start an idle Container`)
  .option(`-z, --stop [container-id]`, `Stop a Container`)
  .action( (args, callback) => {
    let containerId, targetId, dirty
    return api.isDocker()
    .then( (running) => {
      if (running) {
        lastTargetId=api.sqlCatalog.Instance
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
              if (/^close$/i.test(args.options.connection)) {
                sqldb.closePool()
                dirty=true
              } else if (/^open$/i.test(args.options.connection)) {
                sqldb.openPool()
                dirty=true
              } else {
                log.log(`connection pool state: ${sqldb.state()}`)
              }
            break
          case ("docker"):
            log.log(api.format(api.getDockerContainer(containerId)))
            break
          case ("full"):
            log.log(api.format(api.getContainerInfo(containerId)))
            break
          case ("id"):
            if (containerId && containerId!=api.sqlCatalog.Instance) {
              api.catalogInstance(containerId)
              dirty=true
            }
            log.log(`Targeting SQL Server Container: ${containerId}`)
            break
          case ("restart"):
            api.restartContainer(containerId)
            .then( () => {
              log.confirm(`restarted container ${containerId}` )
            })
            .then( () => {
              dirty=true
            })
            break
          case ("start"):
            api.startContainer(containerId)
            .then( () => {
              log.confirm(`started container ${containerId}` )
            })
            .then( () => {
              dirty=true
            })
            break
          case ("stop"):
            api.stopContainer(containerId)
            .then( () => {
              log.confirm(`stopped container ${containerId}` )
              dirty=true
            })
            break
          default:
            break
        }
        if (dirty) {
          api.loadCatalog()
        } else if (targetId && targetId===sqldb.target()) {
            api.catalogInstance(targetId)
            if (api.getContainerInfo(targetId).State==='running') {
              sqldb.openPool(targetId)
            }
        }
      }
    })
    .then( () => {
      // too soon to open pool if (re)started.
      // could tail the container now though if that is helpful?
      // could then even watch for "Recovery Complete" and connect...
      callback()
    })

  })

  vantage.command(`files`, `Inspect SQL Server files by Function`)
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
            filter=config.mssql.dumo.filter
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

  vantage.command(`cache`, `Non-persistent App Object Inspector`)
  .alias(`?`)
  .option(`-b, --batch`, `T-SQL Batch Cache Object`)
  .option(`-c, --compile <sqlcmd|[mssql]>`, `Compile Cache to Query Command`)
  .option(`-k, --key [begin-timestamp[, end-timestamp]]`, `T-SQL Batchs for this CLI Session`)
  .option(`-m, --map [reload]`, `Catalog of SQL Server for Linux Containers`)
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
        case (args.options.map==='reload'):
          api.loadCatalog()
          break
        case (args.options.map):
          log.log(api.sqlCatalog)
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

  vantage.command(`bcp [table-name]`, `Bulk Copy Data`)
  // .option(`-i, --input [data-file| T-SQL | TABLE | VIEW ]`, `source of data`)
  // .option(`-o, --output [data-file]`, `result output file (default stdout)`)
  .action( (args, callback) => {
    log.log(api.bandAid)
    log.debug(`sorry, nothing here. Exit and at bash prompt use the host\'s BCP in /mssql-tools,
      or use the BCP included in the Target SQL Server container (sqlpal command: 'instance --bash')`)
    callback()
  })

  vantage.command(`sqlcmd`, `Process a cached batch or file script via ODBC using sqlcmd`)
  .option(`-e, --execsql`, `Process batch via sp_executesql, `+`after`.italic+` the prefix executes`)
  .option(`-i, --input <script-file>`, `process a T-SQL script file rather than the batch`)
  .option(`-Q, --Query`, `Process the prefixed batch and exit, rendering JSON results`)
  .option(`-p, --prefix [edit]`, `Inspect/Edit SET Statement(s) prefixed to all queries`)
  .option(`-q, --query`, `Process the prefixed batch in sqlcmd, rendering tabular results`)
  .option(`-o, --output <data-file>`, `write result to the file - one of [e, i, Q or q] also required`)
  .option(`-s, --switch [switch-flag]|[edit]`, `Inspect/Edit Command-line switch defaults`)
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
        case (args.options.prefix):
          result=config.sqlcmd.prefix
          break
        case (args.options.switch):
          result=config.sqlcmd.switch
          break
        case (args.options.Query):
          sqlArg=`-Q "${api.compile(config.sqlcmd.prefix)} ${api.compile(Batch)}"`
          break
        case (args.options.query):
          sqlArg=`-q "${api.compile(config.sqlcmd.prefix)} ${api.compile(Batch)}"`
          log.info(`type 'exit' to close sqlcmd and resume `+`sqlpal`.rainbow)
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

  vantage.command(`errorlog [ext]`, `SQL Server errorlog (no extention for active file)`)
  .option(`-h, --head [[-]K]`, `first 'K' lines or up to '-K' (default: first 10)`)
  .option(`-l, --list`, `available log files at ${config.mssql.log.path}`)
  .option(`-t, --tail [[+]K]`, `last 'K' lines or from '+K' (default: last 10)`)
  .action( (args, callback) => {
      switch (true) {
        case (['boolean', 'number'].includes(typeof args.options.head)):
          // head -n K is the number of lines, head -n -K is beginning to line# K
          shellscript = `head ${elog} -n ${typeof args.options.head==='number'? args.options.head: 10}`
          break
        case (args.options.list):
          shellscript = `ls ${elog}| grep elog`
          break
        case (['boolean', 'number'].includes(typeof args.options.tail)):
          // tail -n K is the number of lines, head -n +K is from line# K to end
          shellscript = `tail ${elog} -n ${typeof args.options.tail==='number'? args.options.tail: 10}`
          break
        default :
          // numbers the output lines
          shellscript = `cat ${elog} -n`
          break
      }
      log.debug(`shell-script: ${shellscript}`)
      api.shell(shellscript)
      callback()
  })

  vantage.command(`about`, `sqlpal`.rainbow+ ` Application Information`)
  .option(`-c, --commands`, `CLI Commands with all options (self-document)`)
  .option(`-n, --npm`, `Check for NPM package updates`)
  .option(`-p, --package`, `package.json `)
  .option(`-u, --usage`, `usage information (aka `+`--HELP`.rainbow+`)`)
  .option(`-v, --version`, `version`)
  .action( (args, callback) => {
    switch (true) {
      case (args.options.commands):
        let cmds = vantage.commands
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
      case (['boolean', 'number'].includes(typeof args.options.npm)):
        api.checkNPM()
        break
      case (args.options.package):
        log.log(api.format(package))
        break
      case (args.options.version):
        log.log(`sqlpal version: ${package.version}`)
        break
      case (args.options.usage):
        log.log(api.commandAid(vantage.commands))
        break
      default:
        log.log(api.bandAid)
        vantage.exec(`help about`)
        break
    }
    callback()

  })

  vantage.catch('[tsql...]')
  .description(api.commandAid(vantage.commands)) // --HELP
  .action( (args, callback) => {

    log.debug(`(CLI.catch) args:\n ${api.format(args)}`)
    store.lines.getLast()
    .then( (last) => {
      return last.line
    })
    .then( async (line) => {
      if (line.length>0) {
        log.debug(`(CLI.catch) raw input fetched from nedb:\n ${line}`)
        switch (true) {
          case (!args.tsql):
            break
          case (/^debug$/i.test(args.tsql[0])):
            // ANY loglLevel other than 10 or 20 will suppress normal output!
            if (/^ON$/i.test(args.tsql[1])) {
              vantage.exec(`logLevel 10`)
              log.confirm(`${args.tsql[0]} is ${args.tsql[1]}`)
            }
            if (/^OFF$/i.test(args.tsql[1])) {
              vantage.exec(`logLevel 20`)
              log.confirm(`${args.tsql[0]} is ${args.tsql[1]}`)
            }
            log.log(`To modify sqlpad start-up options, edit 'config.js'.
              e.g., set .debug key true or false to toggle debug logging
              and save the`.gray+`file 'config --app edit'`.italics.gray)
            break
          case (/^GO$/i.test(line)):
            sqldb.query()
            break
          case (/^QUER[Y|I]E*S*$/i.test(line)):
            log.log(api.format(store.queries.names()))
            break
          case (/^QUER[Y|I]E*S*$/i.test(args.tsql[0])):
            log.log(api.format(store.queries.get(args.tsql[0])))
            break
          case (/^RUN$/i.test(line)):
            sqldb.batch()
            break
          case (/^SCRIPTS*$/i.test(line)):
            log.log(await api.listFiles(path.resolve(config.vantage.vorpalCLI.scriptPath), `.sql`))
            break
          case ((args.tsql[1]) && /^SCRIPTS*$/i.test(args.tsql[0])):
            api.fileToBatch(path.resolve(__dirname, config.vantage.vorpalCLI.scriptPath, args.tsql[1]))
            break
          case (/^TEST$/i.test(line)):
            await sqldb.isSQL(api.compile(Batch))
            break
          default:
            Batch.push(line)
            break
        }

      }

      callback()
    })

  })

})
