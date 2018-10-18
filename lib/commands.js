//// NPM
const chalk = require('chalk')
const vorpal = require('vorpal')()
const inquirer = require('inquirer')
//// core
const path = require('path')
//// local
const config = require('../config/config.json')
const { version } = require('../package.json')
const api = require('../lib/api')
const sqldb = require('../lib/sqldb')
const store = require('../lib/store')

const sqlName = chalk.italic(`SQL Server for Linux`)

async function choose(choiceArray, message='Select one') {

  return new Promise( async function(resolve, reject) {
    try {
      inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: message,
        choices: choiceArray
      }])
        .then((result) => {
          resolve(result.choice)
        })
        .catch( err => {
          api.log('error', `(choose) failed`)
          reject(err)
        })  
    }
    catch(err) {
      api.log('error', `(choose) error`)
      reject(err)
    }    
  })

} 

async function input(message='Enter a Response', suggestedResponse) {

  return new Promise( async function(resolve, reject) {
    try {
      inquirer.prompt([{
        type: 'input', 
        name: 'input',
        message: message,
        default: suggestedResponse
      }])
        .then(async (answer) => {
          return resolve(answer.input)
        })
        .catch((err) => {
          api.log('error',`(input) failed`)
          api.log('error', api.format(err))  
        }) 
    }
    catch(err) {
      api.log('error',  `(input) error`)
      reject(err)
    }    
  })
  
} 
  
async function secret(message='Enter Secret') {

  return new Promise( async function(resolve, reject) {
    try {
      inquirer.prompt([{
        type: 'password', 
        name: 'input',
        message: message
      }])
        .then(async (answer) => {
          return resolve(answer.input)
        })
        .catch((err) => {
          api.log('error',`(secret) failed`)
          api.log('error', api.format(err))  
        }) 
    }
    catch(err) {
      api.log('error',  `(secret) error`)
      reject(err)
    }    
  })
  
} 

// let p=0
// vorpal.on('command_registered', (cmd) => {
//   let registered = ``
//   if (cmd.name===`about [topic]`) {
//     registered = `cli vocabulary:\n\t`
//   }  
//   if (config.cli.showEventTimes) {
//     p+=1
//     registered+=`${cmd.name}${cmd.name==='[tsql...]'? ' - help\n':''} ${p%4===0?'\n\t':' - '}`
//     api.log(registered)
//   }
// })

vorpal.on('client_command_executed:', () => {
  api.log('log', chalk`{magenta [client_command_executed]}  ${(config.cli.showEventTimes)? api.getTimestamp(): ''}`)
})

// socket.io-client errors
vorpal.on('client_error', (err) => {
  if (config.cli.showEventTimes) {
    api.log('warn', chalk`{magenta [client_error]}  ${api.getTimestamp()}`)
  }  
  api.log('error', err.stack)
  store.errors.put(err)
})

vorpal.on('client_prompt_submit', (data) => {
  if (data!=='') { // ignore empty 
    if (config.cli.showEventTimes) {
      api.log('debug', chalk`{magenta [client_prompt_submit]}  ${api.getTimestamp()}`)
    }
    store.lines.put(data)
  }
})

vorpal.on('client_command_error', (err) => {
  api.log('error', chalk`{magenta [client_command_error]} ${api.getTimestamp()}\n${api.format(err)}`)
  store.errors.put(err)
})

const aboutTopics = ['cli', 'npm', 'quickstart', 'readme', 'version']
vorpal.command(`about [topic]`, chalk`About ${api.roygbv} (Topics: {italic.bold ${aboutTopics}})`)
  .autocomplete(aboutTopics)
  .action( async (args) => {
    switch (args.topic) {
    case ('cli'):
      api.log('log', api.format(api.commandAid(vorpal.commands)))
      break
    case ('npm'):
      api.log('confirm', 'checking npm for dependency updates...')
      api.log('log', await api.checkNPM())
      break
    case ('quickstart'):
      api.log('log', api.format(api.cliAid()))
      break
    case ('readme'):
      if (args.options.edit) { 
        await api.editFile('README.md')
      } else {
        api.log('log', await api.fileToJSON('./README.md'))
      }  
      break
    case ('version'):
      api.log('log', version)
      break
    default:
      api.log('log', api.bandAid())
      break
    }
  })

let batchActions = ['edit', 'mssql', 'reset', 'sqlcmd'] 
vorpal.command(`batch [activity]`, chalk`The Query now in cache (Activities: {bold.italic ${batchActions}})`)
  .alias('?')
  .autocomplete(batchActions)
  .action( async (args) => {
    switch(args.activity) {
    case ('edit'):
      api.batch = (await api.editText(api.compile())).split('\n')
      break
    case ('reset'):
      api.batch.splice(0)
      api.log('log', 'batch is reset')
      break
    case ('sqlcmd'):
      // prebatch
      api.log('log', chalk`${config.cli.odbc.path}/sqlcmd
            ${api.compile(config.sqlcmd.switch)} 
            {bold.italic -[i|q|Q]} "${api.compile(config.sqlcmd.prefix)} \n${api.compile()}"`)
      break
    case ('mssql'):
    default:
      api.log('log', api.batch.join().length>0?api.compile():'nothing in cache')
      break
    }
  })

  // vorpal.command(`bcp [options]`, `Bulk Copy Data in or out of Target using BCP from mssql-tools`)
  // // .option(`-i, --input [data-file| T-SQL | TABLE | VIEW ]`, `source of data`)
  // // .option(`-o, --output [data-file]`, `result output file (default stdout)`)
  // .action( (args, callback) => {
  //   api.log('warn',`sorry, nothing here (yet?). Exit and at bash prompt use the host\'s BCP in /mssql-tools,
  //     or use the BCP included in the Target SQL Server container (${name} command: 'container --bash')`)
  //   api.log('log', api.bandAid)
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

let catActions = ['all', 'container', 'image', 'network', 'pool', 'remap', 'summary']
vorpal.command(`catalog [action]`, chalk`Local ${sqlName} Docker Metadata Map (Actions: {bold.italic ${catActions.join()}}) default is remap`)
  .autocomplete(catActions)
  .action( async (args) => {
    let id, status
    if (await api.isHost()) {
      switch(args.action) {
      case ('all'):
        api.log('log', chalk.inverse(`SQL Server Images Pulled`.padEnd(26).padStart(30)))
        api.log('log', api.format(api.listImage()))
        api.log('log', chalk.inverse(`Containers Created`.padEnd(26).padStart(30)))
        api.log('log', api.format(api.listInstance()))
        api.log('log', chalk.inverse(`Connection Pools Opened by cli`.padEnd(26).padStart(30)))
        api.log('log', api.format(api.listPool()))
        api.log('log', chalk.cyan.inverse(`cli Target`.padEnd(26).padStart(30)) + chalk`{cyan ${api.sqlCatalog.Instance}}`)
        break
      case ('container'):
        id = await choose(await api.enumContainers(), 'Select a container')
        api.log('log', api.format(await api.getInstanceInfo(id)))
        break
      case ('image'):
        id = await choose(await api.enumImages(), 'Select an image')
        api.log('log', api.format(await api.getImage(id)))
        break
      case ('network'):
        api.log('log', api.format(api.getAddress()))
        break
      case ('pool'):
        await choose(await api.enumPools(), 'Select a pool')
        api.log('log', api.format(await api.listPool(id)))
        break
      case ('remap'):
        await api.intern()
        break
      case ('summary'):
      default:
        if (api.sqlCatalog.Images) {
          
          api.log('log', chalk.inverse(`Images Pulled`.padEnd(26).padStart(30)))
          for (let image of api.sqlCatalog.Images) {
            id = image[0]===api.getInstanceInfo().ImageID? chalk.cyan.bold(`${image[0]}`): image[0] 
            api.log('log', `${id} (v.${image[1].Labels["com.microsoft.version"]}) ${image[1].RepoTags? image[1].RepoTags[0]: ""}`)
          }
          api.log('log', chalk.inverse(`Containers Created`.padEnd(26).padStart(30)))
          for (let info of api.sqlCatalog.ContainerInfos) {
            id = info[0]===api.sqlCatalog.Instance? chalk.cyan.bold(`${info[0]}`): info[0] 
            status = info[1].State!=='running'? chalk.red(info[1].Status): chalk.green(info[1].Status)
            api.log('log', `${id}  (v.${info[1].Labels["com.microsoft.version"]})  ${status}`)
          }
          api.log('log', chalk.inverse(`Connection Pools Opened`.padEnd(26).padStart(30)))
          for (let pool of api.sqlCatalog.Pools) {
            id = pool[0]===api.sqlCatalog.Instance? chalk.cyan.bold(`${pool[0]}`): pool[0] 
            api.log('log', `${id} using '${pool[1].config.database}' as '${pool[1].config.user}' on port ${pool[1].config.port}`)
          }
          api.log('log', chalk.cyan.inverse(`cli Target`.padEnd(26).padStart(30)) + chalk`{cyan.bold ${api.sqlCatalog.Instance}}`)
        }  
        break
      }
    }
  })

let credsTypes = ['all', 'ca', 'certs', 'keys']
vorpal.command(`certificate [listing]`, chalk`Host Certificates (requires root - Listings {bold.italic ${credsTypes}})`)
  .autocomplete(credsTypes)
  .option('--ca', `Generate Signing Credentials for host volume 'private'`)
  .option('--mssql', `Generate & Sign SSL credentials for mssql connections`)
  .option('--sqlpal', `Create & sign SSL credentials for the sqlpal server that runs as a subprocess`)
  .option('--new <name>', chalk`Create and sign credentials {bold {italic <name>}-key.pem} {bold & {italic <name>}-cert.pem})`)
  .option('--roll <name>', `Archive any retired certificates and generate new into the <name> updatable creds`, 
    () => {
      // need to store the names and a checksum of file in nedb & use that here so elevation not needed 
    })
  .option('--sqlserver', `Generate an SSL cert for SQL Server query connections`)
  .option('--sqlpad', `Generate an SSL cert for the sqlpad web server`)
  .action( async function(args){ // no arrow functions if you want to use the _this_ CommandInstance
    // any create or enum of volumes will need docker to be running
    switch(true) {
    case (args.options.all):
      await api.elevate(`ls -l private/`)
      break
    case (args.options.ca):
      await api.genCA()
      break
    case (args.options.keys):
      await api.elevate(`ls private/ -l -I *-cert.pem -I *.csr -I *.srl`)
      break
    case (args.options.mssql):
      await api.genCertificate('mssql', config.mssql["cert-password"])
      break
    case (typeof args.options.new=='string'):
      // openssl dialog will offer .cnf, passphrase will prompt, reprompt, then required for cert gen
      this.prompt({
        type: `password`,
        name: args.options.new,
        default: false,
        message: chalk`{bold.italic ${args.options.new}} private key secret `
      }, async function(result){
        await api.genCertificate(args.options.new, result[args.options.new])
      })
      break
    case (args.options.sqlserver):
      this.prompt({
        type: `password`,
        name: `sqlserver`,
        default: false,
        message: chalk`{bold.italic SQL Server} TLS private key secret `
      }, async function(result){
        await api.genCertificate('sqlserver', result.sqlserver)
      })
      break
    case (args.options.sqlpad):
      this.prompt({
        type: `password`,
        name: `sqlpad`,
        default: false,
        message: chalk`{bold.italic SQLPad} http TLS private key secret `
      }, async (secret) => {
        await api.genCertificate('sqlpad', secret)
      })
      break
    case (args.options.certs):
      api.log('log', await api.elevate(`ls private/ -l -I *-key.pem -I *.csr -I *.srl`))
      break
    default:
      vorpal.exec('help certificate')
      break
    }

  })

let containerActions = ['all','bash','close','full','last','name','open','remove','restart','start','stop','target']  
vorpal.command(`container [action]`, chalk`${sqlName} Containers (Actions {bold.italic ${containerActions}})`)
  .autocomplete(containerActions)
  .option(chalk`-s, --sync`, `Sync the cached SQL Catalog to the current Docker State before the command`)
  .action( async (args) => {
    if (args.options.sync) await api.intern()
    if (await api.isHost()) {
      let idle = []
      let pools = api.enumPools()
      let running = []
      if (api.sqlCatalog.ContainerInfos) {
        for (let info of api.sqlCatalog.ContainerInfos) {
          if (info[1].State==='running') {
            running.push(info[0])
          } else {
            idle.push(info[0])
          }
        }
      }      
      let containerId
      switch(args.action) {
      case ('all'):
        api.log('log', api.format(api.listInstance()))
        break
      case ('bash'):
        containerId = await choose(running, api.sqlCatalog.Instance, 'Choose container to be opened in shell')
        await api.interactiveShell(containerId)
        break
      case ('close'):
        containerId = await choose(pools, api.sqlCatalog.Instance, 'Choose container of connection pool to close')
        await api.closeInstance(containerId)
        break
      case ('last'):
        // how many?
        api.log('log', api.format(await api.latestInstances(5)))
        break
      case ('name'):
        containerId = await choose(running.concat(idle), api.sqlCatalog.Instance, 'Choose container to name')
        await api.nameInstance(containerId)
        // just need to correct one attrib in one object... intern is brute force....
        await api.intern()
        break
      case ('open'):
        for (let pool of api.enumPools()) {
          running.splice(running.indexOf(pool),1)
        }  
        containerId = await choose(running, api.sqlCatalog.Instance, 'Choose container to name')
        await api.openInstance(containerId) 
        break
      case ('remove'):
        containerId = await choose(idle, '', 'Choose container to remove')
        await api.removeInstance(containerId)
        api.log('confirm', chalk`Removed ${containerId}`)
        await api.intern()
        break
      case ('restart'):
        containerId = await choose(running, api.sqlCatalog.Instance, 'Choose container to restart')
        await api.restartInstance(containerId)
        api.log('confirm', chalk`Restarted ${containerId}`)
        await api.intern()
        break
      case ('start'):
        containerId = await choose(idle, idle.includes(api.sqlCatalog.Instance)?api.sqlCatalog.Instance: '', 'Choose container to start')
        await api.startInstance(containerId)
        api.log('confirm', chalk`Started ${containerId}`)
        await api.intern()
        break
      case ('stop'):
        containerId = await choose(running, api.sqlCatalog.Instance, 'Choose container to stop')
        api.format(await api.stopInstance(containerId))
        api.log('confirm', chalk`Stopped ${containerId}`)
        await api.intern()
        break
      case ('target'):
        containerId = await choose(running.concat(idle), api.sqlCatalog.Instance, 'Choose container CLI is to now target')
        await api.intern(containerId)
        api.log('log', `Targeting Container: ${api.sqlCatalog.Instance}`)
        break
      case ('full'): 
      default:
        containerId = await choose(running.concat(idle), api.sqlCatalog.Instance, 'Choose container Docker API object to show')
        api.log('log', api.format(api.getInstanceInfo(containerId)))
        break
      }
    }
  })

let engineActions = ['start', 'stop', 'reload', 'restart', 'try-restart', 'force-reload', 'status'] 
vorpal.command(`engine <action>`, chalk`Docker Container Engine (requires root - Actions {bold.italic ${engineActions}})`)
  .autocomplete(engineActions)
  .action( async (args) => {
    await api.setEngine(args.action)
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
    if (await api.isHost()) {
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

vorpal.command('go', `Execute the Batch on the Target SQL Server using mssql.Request.query()`)
  .action( async () => {
    try {
      if (api.sqlCatalog.Pools.has(api.sqlCatalog.Instance)) {
        let query = api.compile(api.batch)
        let result = await sqldb.query(query.trim(), api.sqlCatalog.Instance)
        if (result.recordsets.len>1) {
          api.log('log', api.format(result.recordsets))
          if (Object.keys(result.output).length>0) api.log('log', `output: ${api.format(result.output)}`)
        }  
        else api.log('log', api.format(result))
        if (result.rowsAffected[0]>0) api.log('log', `rowsAffected: ${result.rowsAffected}`)
        api.batch.splice(0)
      }
    }
    catch (err) {
      api.log('error', api.format(err))
    }
  })

let historyCollections = Object.keys(store) 
vorpal.command(`history <collection>`, chalk`Search nedb logged CLI history (Collections {bold.italic ${historyCollections}})`)
  .autocomplete(historyCollections)
  .option('-l, --limit [limitNumber]', `default is 8`)
  .option('-k, --skip [skipNumber]', `default is 0`)
  .option('-p, --projection [projectionJSON]', `default is {}`)
  .option('-q, --query [queryJSON]', `default is {}`)
  .option('-s, --sort [sortJSON]', `default is {}`)
  .action( async (args) => {
    api.log('log', api.format(await store.search(args)))
  })

let imageActions = ['list', 'object', 'pull', 'run']
vorpal.command(`image [action]`, chalk`Local '${config.docker.pull.repo}' Dockerhub Images (Actions {bold.italic ${imageActions}})`)
  .autocomplete(imageActions)
  .action( async (args) => {
    let imageId 
    if (await api.isHost()) {
      switch (args.action) {
      case ('list'):
        api.log('log', api.format(api.listImage()))
        break
      case ('pull'):
        api.log('log', await api.pullImage())
        break
      case ('run'):
        imageId = await choose(await api.enumImages(), 'Select an Image to use to Create a Container')
        await api.runImage(imageId)
        break
      case ('object'):
        imageId = await choose(await api.enumImages(), 'Select an image')
        api.log('log', api.format(await api.getImage(imageId)))
        break
      default:
        api.log('log', api.format(await api.getImage()))
        break
      }
    }
  })

vorpal.command(`issql`, chalk`Evaluate Batch as tSQL on Target - uses {bold.italic SET NOEXEC ON} {yellow objects are not verified}`)
  .action( async () => {
    if (api.batch.join().length>0) {
      if (await api.isHost()) {
        if (await sqldb.isSQL(api.compile(), api.sqlCatalog.Instance)) {
          api.log('log', chalk`{bold.green \u2713} valid t-SQL according to ${api.sqlCatalog.Instance}`)
        }
      }
    }
  })

  // timestamps in logs comes from SQL Server - no on/off --timestamps
vorpal.command(`log [container-id]`, `Container Log`)
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
        }
      }
    }
    return ids
  })
  .action( async (args) => {

    let containerId = args["container-id"] || api.sqlCatalog.Instance
    if (await api.isHost() && api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
      await api.tailLog(containerId, false)
    }

  })
let queryActions = ['archive', 'delete', 'edit', 'get', 'import', 'load', 'put', 'sync']  
vorpal.command(`query [action]`, chalk`${api.roygbv} query store (Actions: {bold.italic ${queryActions}} default is load)`)
  .autocomplete(queryActions)
  .action( async (args) => {
    let queryName, suggestedName
    let available=await store.queries.names()
    switch(args.action) {
    case ('archive'):
      suggestedName = path.resolve(config.cli.script.path, `queries_export_${(new Date()).toISOString()}`)
      await api.archiveQueries(await input('Target file for queries collection export', suggestedName))
      break
    case ('delete'):
      queryName = await choose(available, '', 'Query to delete')
      store.queries.remove(queryName)
      break
    case ('edit'):
      queryName = await choose(available, 'Query to edit')      
      store.queries.upsert(queryName, await api.editText(await store.queries.get(queryName)))
      break
    case ('get'): // can use to refer back to existing while composing - does not touch Batch
      queryName = await choose(available, 'query to show')
      api.log('log', api.format(await store.queries.get(queryName)))
      break
    case ('import'):
      store.queries.import()
      api.log('log', 'query store is loaded from queries.js')
      break
    case ('put'):
      store.queries.put(await input('Name for Query in Store'), api.compile())
      break
    case ('sync'):
      await api.archiveQueries(path.resolve('lib/queries.js'))
      api.log('log', 'query store has overwritten queries.js')
      break
    case ('load'): 
    default:
      queryName = await choose(available, 'query to load into the Batch')
      api.batch = (await store.queries.getBatch(queryName))
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
    if (await api.isHost()) {
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
      let results = await sqldb.batch(api.compile(), api.sqlCatalog.Instance)
      for (let result of results)
      { 
        if (result.recordsets.length>0) {
          for (let rs of result.recordsets) {
            api.log('log', api.format(rs))
          }
        }  
        else if (result.recordset) api.log('log', api.format(result.recordset))
        else api.log('info', api.format(result))
      }
      api.batch.splice(0)
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
          api.log('log', '\n  Scripts:\n')
          for (let script of await api.listFiles(path.resolve(config.cli.script.path), config.cli.script.filter)) {
            api.log('log', '    ' + script.replace(config.cli.script.filter, ''))
          }
          api.log('confirm', `Script FileName Autocomplete enabled`)
        } else {
          await api.fileToBatch(path.resolve(config.cli.script.path, args.fileName+config.cli.script.filter))
        }
        break
      }
    }
    catch(err) {
      api.log('error',`(command script) error`)
      api.log('error', api.format(err))
    }
  })

vorpal.command(`settings`, `Configuration Settings`)
  .option(`-e, --edit`, `Edit ${api.roygbv} 'config.json' file with '${config.cli.editor}'`)
  .option(chalk`-m, --mssqlconf [mssql-conf-key[value] | {underline f}ile]`, `Target Container's mssql-conf.py utility or mssql.conf out file`)
  .action( async (args) => {
    switch(true) {
    case (args.options.edit):
      await api.editFile(`config/config.json`)
      break
    case (args.options.app===true):
      api.log('log', await api.fileToJSON('config/config.json'))
      break
    // appears this might work this way if host python happy when using mssql-conf.py ??? is it persistant???
    case (/^fi*l*e*$/i.test(args.options.mssqlconf)):
      if (await api.isHost() && api.sqlCatalog.Instance) {
        api.shell(api.sqlCatalog.Instance, `cat ${path.resolve(config.mssql.bin.path, 'mssql.conf')}`)
      }
      break
    case (typeof args.options.mssqlconf==='string'):
      if (await api.isHost() && api.sqlCatalog.Instance) {
        let argpair = await store.lines.getLast()
        await api.mssqlConf(api.sqlCatalog.Instance, argpair.line.split(' ').slice(2).join(' '))
      }
      break
    case (args.options.mssqlconf===true):
      if (await api.isHost() && api.sqlCatalog.Instance) {
        await api.mssqlConf(api.sqlCatalog.Instance, '-h')
      }
      break
      // end of mssql-conf.py stuff
    case (args.options.current):
    default:
      api.log('log', config)
      break
    }
  })

let sqlcmdActions = ['exec', 'flags', 'input', 'session', 'wrap']
vorpal.command(`sqlcmd [action]`, chalk`Run queries via {bold.italic sqlcmd} from mssql-tools of Target - (Actions: {bold.italic ${sqlcmdActions}})`)
  .autocomplete(sqlcmdActions)
  .option('-o, --output', 'Save displayed output to a file on the host. config.sqlcmd.o overrides this option and writes inside container')
  .option(`-?, --usage`, 'sqlcmd command-line usage message')
  .action( async (args) => {
    if (await api.isHost()) {
      let containerId = api.sqlCatalog.Instance
      if (containerId) {
        let cmdArgs = [] // populated from config.sqlcmd
        let sqlArg = ''  
        let tsql = `"${api.compile(config.sqlcmd.prebatch)}\nGO\n${api.compile(config.sqlcmd.prefix)}\n${api.compile()}"`
        switch(args.action) {
        case ('wrap'): 
          sqlArg=`-Q` 
          tsql= `${api.compile(config.sqlcmd.prebatch)}\nGO\n"${api.compile(config.sqlcmd.prefix)} exec sp_executesq('${api.compile()}')"`
          break

// !!!!it won't know this path unless it is in the container!!! has to be a volume!!!!  

        case (args.input):
          inquirer.prompt([{
            type: 'input', 
            name: 'volume',
            message: `In which Volume in the container will the input file be found?`
          },{
            type: 'input', 
            name: 'file',
            message: `TSQL script-file? (absolute or relative path on ${api.roygbv} host)`
          }])
            .then((answer) => {
              sqlArg=`-i "${path.resolve(answer.file)}"`
            })
            .catch((err) => {
              api.log('error',`(sqlcmd) wrap error`)
              api.log('error', api.format(err))  
            }) 
          break
        case ('exec'):
          sqlArg = `-Q` 
          break
        case ('session'):
          sqlArg=`-q`
          break
        case ('usage'):
        default:
          await api.shell(containerId, `${path.resolve(config.cli.odbc.path, 'sqlcmd -?')}`)
          break
        }
        if (sqlArg) {
          let cfgUser = config.sqlcmd.switch.U
          config.sqlcmd.switch.U = await input(chalk`{bold.italic SQL Server} user name`, config.sqlcmd.switch.U)
          if (config.sqlcmd.switch.U!==cfgUser || !config.sqlcmd.switch.P) {
            config.sqlcmd.switch.P = await secret(chalk`{bold.italic SQL Server} user password`)
          } 
          config.sqlcmd.switch.d = config.mssql.pool.database
          Object.keys(config.sqlcmd.switch).forEach((key) => {
            cmdArgs.push(`-${key}`)
            if (config.sqlcmd.switch[key]!==key) {
              cmdArgs.push(config.sqlcmd.switch[key])
            }
          })
          let result = await api.shell(containerId, `sqlcmd ${cmdArgs.join(' ')} ${sqlArg}`, tsql)
          api.batch.splice(0)
          if (args.options.output) {
            let suggestedName = path.resolve(config.cli.script.path, `outfile_${(new Date()).toISOString()}`)            
            api.writeResults(await input('Host file where output is to be stored', suggestedName), result) 
          }
        }
      }
    }
  })

const sqlpadActions=['configure', 'status', 'start', 'stop']
vorpal.command(`sqlpad [action]`, chalk`SQLPad http query store - Actions: {italic.bold ${sqlpadActions.join(', ')}})`)
  .autocomplete(sqlpadActions)
  .action( async function(args) {
    switch (args.action) {
    case ('configure'):
      await api.editFile(`config/config.json`)
      break
    case ('start'):
      this.prompt({
        type: `password`,
        name: `sqlpad`,
        default: config.sqlpad["cert-passphrase"],
        message: chalk`{gray Optional} {bold SQLPad} cert-secret [Hit Enter to use {bold.italic config.sqlpad["cert-passphrase"}...`
      }, async function(secret){
        config.sqlpad["cert-passphrase"] = secret.sqlpad
        await api.startSQLPad()
      })
      break
    case ('stop'):
      api.sqlpad.kill(1)
      break
    case ('url'):
      break
    case ('status'):  
    default:
      if (!config.sqlpad["sqlpad"]) {
        api.log('log', chalk`SQLPad web server not attached, try {bold.italic sqlpad start}`)
      } else {
        api.log('log', `SQLPad is Running \nPID: ${config.sqlpad["sqlpad"]}\nURI: https://127.0.0.1:${config.sqlpad["https-port"]}`)
      }
      break
    }
  })

// add the test extension when called for as in 'node server.js test' or 'npm start test'
if (process.argv.length===3 && process.argv[2]==='test') {
  const tests = require(`../tests/${process.argv[2]}`)
  vorpal.use(tests)
} 

vorpal.command(`use <db-name>`, `CLI Database Context - change Target's Connection Pool database`)
  .autocomplete( async () => {
    let databases = []
    let results = await sqldb.query('select name from sysdatabases', api.sqlCatalog.Instance)
    for (let db of results.recordset) {
      databases.push(db.name)
    }
    return databases
  })
  .action( async (args) => {
    if (api.sqlCatalog.Pools.has(api.sqlCatalog.Instance)) {
      await api.openInstance(api.sqlCatalog.Instance, args["db-name"])
    }
  })

vorpal.catch('[tsql...]')
  .description(api.commandAid(vorpal.commands)) // --HELP
  .action( async () => {
    api.batch.push((await store.lines.getLast()).line)
  })
  
api.isHost()
  .then( async (foundDockerSocket) => {
    if (foundDockerSocket) {
      await api.genCA()
      await api.intern()
      if (config.sqlpad.enabledAtStartup) {
        await api.startSQLPad() 
      }
    } else {
      api.log('log', api.format(api.cliAid()))
    }
  })
  .catch( (err) => {
    api.log('error', api.format(err))
  })
  .finally(() => {
    module.exports = exports = vorpal
      .delimiter(`sqlpal >`)
      .show()
  })


  