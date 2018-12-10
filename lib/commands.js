//// NPM
const chalk = require('chalk')
const vorpal = require('vorpal')()
const inquirer = require('inquirer')
//// core
const path = require('path')
//// local
const { version } = require('../package.json')
const api = require('../lib/api')
const sqldb = require('../lib/sqldb')
const store = require('../lib/store')

const config = require('../config/config.json')
const sqlpad = require('../config/sqlpad.json')

const sqlName = chalk.italic(`SQL Server for Linux`)

// vorpal.on('client_command_executed:', () => {
//   api.log('log', chalk`{magenta [client_command_executed]}  ${(config.cli.showEventTimes)? api.getTimestamp(): ''}`)
// })

// socket.io-client errors
vorpal.on('client_error', err => {
  api.log('error', chalk`{magenta [client_error]} \n${api.format(err)}`)
  store.errors.put(JSON.stringify(err))
})

vorpal.on('client_prompt_submit', data => {
  if (data!=='') {
    store.lines.put(data)
  }
})

vorpal.on('client_command_error', err => {
 api.log('error', chalk`{magenta [client_command_error]} \n${api.format(err)}`)
  store.errors.put(JSON.stringify(err))
})

// vorpal.on('command_registered', cmd => {})

async function choose(choiceArray, message='Select one', suggestedResponse) {

  return new Promise( async (resolve, reject) => {
    try {
      if (!choiceArray || choiceArray.length===0) resolve()
      inquirer.prompt([{
        type: 'list',
        name: 'choice',
        message: message + ' ',
        choices: choiceArray,
        default: suggestedResponse 
      }])
        .then( result => {
          resolve(result.choice)
        })
        .catch( err => {
          api.log('error', `(choose) ${err}`)
          reject(err)
        })  
    }
    catch(err) {
      api.log('error', `(choose) - ${err}`)
      reject(err)
    }    
  })

} 

async function input(message='Enter a Response', suggestedResponse) {

  return new Promise( async (resolve, reject) => {
    try {
      inquirer.prompt([{
        type: 'input', 
        name: 'input',
        message: message + ' ',
        default: suggestedResponse
      }])
        .then(async answer => {
          return resolve(answer.input)
        })
        .catch( err => {
          api.log('error',`(input) failed`)
          api.log('error', api.format(err))  
        }) 
    }
    catch(err) {
      api.log('error', `(input) error`)
      reject(err)
    }    
  })
  
} 
  
async function secret(message='Enter Secret') {

  return new Promise( async (resolve, reject) => {
    try {
      inquirer.prompt([{
        type: 'password', 
        name: 'input',
        message: message + ' ',
      }])
        .then(async answer => {
          return resolve(answer.input)
        })
        .catch( err => {
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

vorpal.command(`about [topic]`, chalk`About ${api.name}`)
  .autocomplete(['cli', 'icons', 'quickstart', 'readme', 'sqlcmd', 'test', 'version'])
  .action( async args => {
    try {
      switch (args.topic) {
        case ('cli'):
          api.log('log', api.format(api.commandAid(vorpal.commands)))
          break
        case ('icons'):
          api.log('log', chalk`{bold \u2042}  catalog`)
          api.log('confirm', ' confirm')
          api.log('debug', ` debug`)
          api.log('error', ` error`)
          api.log('info', ` info`)
          api.log('log', `log`)
          api.log('log', chalk` {rgb(255, 136, 0) \u2A1D}  sqldb`)
          api.log('log', chalk`{bold.yellow ${"\u{1F934}"}}  {magenta sudo}`)
          api.log('test', `test`)
          api.log('warn', ` warn`)
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
        case('sqlcmd'):
          api.log('log', await api.fileToJSON('./docs/cheatsheet.md'))
          break  
        case('test'):
          api.log('log', await api.fileToJSON('./docs/test.md'))
          break  
        case ('version'):
          api.log('log', version)
          break
        default:
          api.log('log', api.bandAid())
          break
        }    
    }
    catch(err) {

    }
    finally {

    }
  })

vorpal.command(`batch [action]`, chalk`The Query now in cache`)
  .alias('?')
  .autocomplete(['edit', 'mssql', 'reset', 'sqlcmd'])
  .action( async args => {
    switch(args.action) {
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

vorpal.command(`catalog [action]`, chalk`Local ${sqlName} Docker Metadata Map`)
  .autocomplete(['all', 'container', 'image', 'network', 'pool', 'remap', 'summary'])
  .action( async args => {
    let id, status
    if (await api.isHost()) {
      switch(args.action) {
      case ('all'):
        api.log('log', chalk.inverse(`SQL Server Images Pulled`.padEnd(26).padStart(30)))
        api.log('log', api.format(api.listImages()))
        api.log('log', chalk.inverse(`Containers Created`.padEnd(26).padStart(30)))
        api.log('log', api.format(api.listInstances()))
        api.log('log', chalk.inverse(`Connection Pools Opened by this CLI`.padEnd(26).padStart(30)))
        api.log('log', api.format(api.listPools()))
        api.log('log', chalk.cyan.inverse(`CLI Target Pool`.padEnd(26).padStart(30)) + chalk`{cyan ${api.sqlCatalog.Instance}}`)
        break
      case ('container'):
        id = await choose(Array.from(api.sqlCatalog.ContainerInfos.keys()), 'Select a container')
        api.log('log', api.format(await api.getInstanceInfo(id)))
        break
      case ('image'):
        id = await choose(Array.from(api.sqlCatalog.Images.keys()), 'Select an image')
        api.log('log', api.format(await api.getImage(id)))
        break
      case ('network'):
        api.log('log', api.format(api.getAddress()))
        break
      case ('pool'):
        await choose(Array.from(api.sqlCatalog.Pools.keys()), 'Select a pool')
        api.log('log', api.format(await api.listPools(id)))
        break
      case ('remap'):
        await api.intern()
        break
      case ('summary'):
      default:
        if (api.sqlCatalog.Images) {
          
          api.log('log', chalk.inverse(`Images Pulled`.padEnd(26).padStart(30)))
          for (let image of api.sqlCatalog.Images) {
            id = image[0]===api.sqlCatalog.Instance && api.getInstanceInfo().ImageID? chalk.cyan.bold(`${image[0]}`): image[0] 
            api.log('log', `${id} (v.${image[1].Labels["com.microsoft.version"]}) ${image[1].RepoTags? image[1].RepoTags[0]: ""}`)
          }
          api.log('log', chalk.inverse(`Containers Created`.padEnd(26).padStart(30)))
          for (let info of api.sqlCatalog.ContainerInfos) {
            id = info[0]===api.sqlCatalog.Instance? chalk.cyan.bold(`${info[0]}`): info[0] 
            status = info[1].State!=='running'? chalk.red(info[1].Status): chalk.green(info[1].Status)
            api.log('log', `${id}  (v.${info[1].Labels["com.microsoft.version"]})  ${status}`)
          }
          api.log('log', chalk.inverse(`Connection Pools Opened by this CLI`.padEnd(26).padStart(30)))
          for (let pool of api.sqlCatalog.Pools) {
            id = pool[0]===api.sqlCatalog.Instance? chalk.cyan.bold(`${pool[0]}`): pool[0] 
            api.log('log', `${id} using '${pool[1].config.database}' as '${pool[1].config.user}' on port ${pool[1].config.port}`)
          }
          api.log('log', chalk.cyan.inverse(`CLI Target Pool`.padEnd(26).padStart(30)) + chalk`{cyan.bold ${api.sqlCatalog.Instance}}`)
        }  
        break
      }
    }
  })

vorpal.command(`certificate [socket-name]`, chalk`TLS Credentials (requires root)`)
  .autocomplete(['docker', 'sqlpad', 'sqlserver'])
  .option('-c, --clientAuth', chalk`Use for CLI TLS Client Authentication `)
  .option(`--hotelJuliet`, chalk`Removal of all credentials & generate a new 'ca'`)
  .action( async args => {
    if (args.options.hotelJuliet) {
      api.hotelJuliet()
    } else if (['docker', 'sqlpad', 'sqlserver'].includes(args["socket-name"])) {
      if (args.options.clientAuth) {
        await api.genCertificate(args["socket-name"]+'CLI', 'clientAuth')
      } else {
        await api.genCertificate(args["socket-name"], 'serverAuth')
      }
    } else {
      api.log('log', (await api.listFiles(config.docker.bindings.private.mount.Source, args["socket-name"] || '.pem')).join('\n'))
    }
  })

vorpal.command(`container [action]`, chalk`${sqlName} Containers`)
  .autocomplete(['all','bash','close','full','last','name','open','remove','restart','start','stop','target'])
  .option(chalk`-s, --sync`, `Sync the cached SQL Catalog to the current Docker State before the command`)
  .action( async args => {
    if (args.options.sync) await api.intern()
    if (await api.isHost()) {
      let containerId
      switch(args.action) {
      case ('all'):
        api.log('log', api.format(api.listInstances('all')))
        break
      case ('bash'):
        containerId = await choose(api.listInstanceIds('up'), 'Choose container to be opened in shell', api.sqlCatalog.Instance)
        await api.interactiveShell(containerId)
        break
      case ('close'):
        containerId = await choose(api.listPools(), 'Choose container of connection pool to close', api.sqlCatalog.Instance)
        await api.closeInstance(containerId)
        api.log('confirm', chalk`Closed ${containerId}`)
        break
      case ('last'):
        // how many?
        api.log('log', api.format(await api.latestInstances(5)))
        break
      case ('name'):
        containerId = await choose(api.listInstanceIds('all'), 'Choose container to name', api.sqlCatalog.Instance)
        await api.nameInstance(containerId)
        // just need to correct one attrib in one object... intern seems brute force.... but avoids some potential for corruption 
        await api.intern()
        break
      case ('open'):
        for (let pool of Array.from(api.sqlCatalog.Pools.keys())) {
          running.splice(running.indexOf(pool),1)
        }  
        containerId = await choose(api.listInstanceIds('up'), 'Choose container to open', api.sqlCatalog.Instance)
        await api.openInstance(containerId) 
        break
      case ('remove'):
        containerId = await choose(api.listInstanceIds('idle'), 'Choose stopped container to remove')
        await api.removeInstance(containerId)
        api.sqlCatalog
        api.log('confirm', chalk`Removed ${containerId}`)
        await api.intern() 
        break
      case ('restart'):
        containerId = await choose(api.listInstanceIds('up'), 'Choose container to restart', api.sqlCatalog.Instance)
        await api.restartInstance(containerId)
        api.log('confirm', chalk`Restarted ${containerId}`)
        await api.intern()
        break
      case ('start'):
        containerId = await choose(api.listInstanceIds('idle'), 'Choose container to start', api.sqlCatalog.Instance)
        await api.startInstance(containerId)
        api.log('confirm', chalk`Started ${containerId}`)
        await api.intern()
        break
      case ('stop'):
        containerId = await choose(api.listInstanceIds('up'), 'Choose container to stop', api.sqlCatalog.Instance)
        api.format(await api.stopInstance(containerId))
        api.log('confirm', chalk`Stopped ${containerId}`)
        await api.intern()
        break
      case ('target'):
        containerId = await choose(api.listInstanceIds('all'), 'Choose container CLI is to now target')
        await api.intern(containerId)
        api.log('log', `Targeting Container: ${api.sqlCatalog.Instance}`)
        break
      case ('full'): 
      default:  
        containerId = await choose(api.listInstanceIds('all'), 'Choose container object to show', api.sqlCatalog.Instance)
        api.log('log', api.format(api.getInstanceInfo(containerId)))
        break
      }
    }
  })

vorpal.command(`engine [action]`, chalk`Docker Container Engine systemd controller (requires root)`)
  .autocomplete(['start', 'stop', 'reload', 'restart', 'try-restart', 'force-reload', 'status'])
  .action( async (args, cb) => {
    let action = args.action || 'status'
    await api.setEngine(action)
    cb()
  })

const fileClasses = 
vorpal.command(`file [type]`, chalk`List Files by class {italic within} a SQL Server Container`)
  .autocomplete(['agent', 'backup', 'dump', 'data', 'errorlog', 'log', 'private', 'staging'])
  .option('-b, --browse', ``)
  .action( async args => {
    if (await api.isHost()) {
      let folder
      let filter
      let containerId = await choose(api.listInstanceIds('up'), 'Choose container', api.sqlCatalog.Instance)
      if (api.sqlCatalog.ContainerInfos.has(containerId) &&
        api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
        switch(args["type"]) {
        case ('agent'):
          folder=config.mssql.env[`MSSQL_ERRORLOG_DIR`]
          filter='sqlagent'
          break
        case ('backup'):
          folder=config.mssql.env[`MSSQL_BACKUP_DIR`]
          filter='.bak'
          break
        case ('dump'):
          folder=config.mssql.env[`MSSQL_DUMP_DIR`]
          filter='core'
          break
        case ('data'):
          folder=config.mssql.env[`MSSQL_DATA_DIR`]
          filter='.mdf'
          break
        case ('errorlog'):
          folder=config.mssql.env[`MSSQL_ERRORLOG_DIR`]
          filter='errorlog'
          break
        case ('log'):
          folder=config.mssql.env[`MSSQL_LOG_DIR`]
          filter=`.ldf`
          break
        case ('private'):
          folder=config.mssql.env[`PRIVATE_DIR`]
          filter=`.pem`
          break
        case ('staging'):
          folder=config.mssql.env[`STAGING_DIR`]
          filter=`''`
          break
        default:
          folder=''
          filter=`''`
          break
        }
        filter = await input('file filter?', filter)
        await api.mssqlFiles(containerId, folder, filter)
      }
    }
  })

vorpal.command('go', `Execute the Batch on the Target SQL Server using mssql.Request.query()`)
  .action( async () => {
    try {
      let result
      let query = api.compile(api.batch)
      if (api.sqlCatalog.Pools.has(api.sqlCatalog.Instance)) {
        result = await sqldb.query(query.trim(), api.sqlCatalog.Instance)
        if (result.recordsets.length>0) {
          for (let rs of result.recordsets) {
            api.log('log', api.format(rs))
          }
        }  
        else if (result.recordset) api.log('log', api.format(result.recordset))
        else api.log('info', api.format(result))
        if (result.rowsAffected[0]>0) api.log('log', `rowsAffected: ${result.rowsAffected}`)
        api.batch.splice(0)
      } 
    }
    catch (err) {
      api.log('error', api.format(err))
    }
  })

vorpal.command(`history`, chalk`Query a nedb collection`)
  .action( async () => {
    let isJSON = val => {
      try{
        JSON.parse(val)
        return true
      }
      catch (syntaxError) {
        api.log('error', api.format(syntaxError))
        return false
      }
    }
    try {
      api.log('info', chalk`Query builder for CLI nedb object store with MongoDB API.
      The {bold.italic find}, {bold.italic projection} and {bold.italic sort} objects must be input as
      well-formed JSON (JSON.stringify(obj)).  
      Hit {bold.italic Ctrl-C} (once!) to abandon the Query Builder.`)
      let collection = await choose(Object.keys(store), 'Collection')
      let find
      do {
        find = await input(`find - JSON:`, JSON.stringify({}))
      }
      while (!isJSON(find)) 
      let projection
      do {
        projection = await input('projection - JSON:', JSON.stringify({}))
      }
      while (!isJSON(projection)) 
      let sort
      do {
        sort = await input('sort - JSON', JSON.stringify({createdAt: -1}))
      }
      while (!isJSON(sort)) 
      let limit = await input('limit - integer', '8')
      let skip = await input('skip - integer', '0')
      api.log('log', api.format(await store.search(collection, JSON.parse(find), JSON.parse(projection), JSON.parse(sort), limit, skip)))
    }
    catch(err) {
      api.log('error', api.format(err))
    }
  })

vorpal.command(`image [action]`, chalk`Local '${config.docker.pull.repo}' Dockerhub Images`)
  .autocomplete(['all', 'full', 'pull', 'run'])
  .action( async args => {
    let imageId 
    if (await api.isHost()) {
      switch (args.action) {
      case ('all'):
        api.log('log', api.format(api.listImages()))
        break
      // case ('prune'): api.docker.images.prune() only dangling (unused, untagged) and only sql
      case ('pull'):
        api.log('log', await api.pullImage())
        break
      // case ('rm'): only if dangling and sql
      case ('run'):
        imageId = await choose(Array.from(api.sqlCatalog.Images.keys()), 'Select an Image to use to Create a Container')
        await api.runImage(imageId)
        break
      case ('full'):
        imageId = await choose(Array.from(api.sqlCatalog.Images.keys()), 'Select an image')
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

vorpal.command(`log`, `Container Log`)
  .action( async args => {
    let containerId = await choose(api.listInstanceIds('up'), 'Choose container CLI is to now target', api.sqlCatalog.Instance)
    if (await api.isHost() && api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
      await api.tailLog(containerId, false)
    }

  })

vorpal.command(`query [action] [filter]`, chalk`${api.name} query store`)
  .autocomplete(['archive', 'delete', 'edit', 'get', 'import', 'load', 'put', 'sync'])
  .action( async args => {
    try{
      let queryName, suggestedName
      let available = await store.templates.names(args.filter)
      if (!available || available.length===0) {
        store.templates.import()
      }
      switch(args.action) {
      case ('archive'):
        suggestedName = path.resolve(config.cli.scripts.path, `queries_export_${(new Date()).toISOString()}`)
        await api.archiveQueries(await input('Target file for queries collection export', suggestedName))
        break
      case ('delete'):
        queryName = await choose(await store.templates.names(args.filter), 'Query to delete')
        store.templates.remove(queryName)
        break
      case ('edit'):
        queryName = await choose(await store.templates.names(args.filter), 'Query to edit')      
        store.templates.upsert(queryName, await api.editText(await store.templates.get(queryName)))
        break
      case ('get'): // can use to refer back to existing while composing - does not touch Batch
        queryName = await choose(await store.templates.names(args.filter), 'query to show')
        api.log('log', api.format(await store.templates.get(queryName)))
        break
      case ('import'):
        store.templates.import()
        api.log('log', 'query store is loaded from queries.js')
        break
      case ('put'):
        store.templates.put(await input('Name for Query in Store'), api.compile())
        break
      case ('sync'):
        await api.archiveQueries(path.resolve('lib/queries.js'))
        api.log('log', 'query store has overwritten queries.js')
        break
      case ('load'): 
      default:
        queryName = await choose(await store.templates.names(args.filter), 'query to load into the Batch', suggestedName)
        api.batch = (!queryName)? '': (await store.templates.get(queryName)).split('\n')
        break
      }
    }  
    catch(err) {
      api.log('error', chalk`no queries in store, try {bold.italic query import}`)
      api.log('error', `${err}`)
    }  
  })

vorpal.command(`run`, `Submit Batch to Target using mssql.Request.batch()`)
  .option(chalk`-s, --showplan [{underline A}LL|{underline T}EXT|{underline X}ML]`,
    chalk`Wrap in {bold.italic SET SHOWPLAN_ALL|TEXT|XML ON/OFF}`)
  .option(chalk`-t, --statistics [{underline I}O|{underline P}ROFILE|{underline T}IME|{underline X}ML]`,
    chalk`Wrap in with {bold.italic SET STATISTICS IO|PROFILE|XML ON/OFF} statement to batch`)
  .action( async args => {
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

vorpal.command(`script [action] [filter]`, `T-SQL script files in ${config.cli.scripts.path}`)
  .autocomplete(['archive', 'backup', 'develop', 'edit', 'get', 'new', 'restore', 'save', 'load'])
  .action( async args => {
    try {
      let scriptName
      let text
      let available = []
      for (let name of await api.listFiles(path.resolve(config.cli.scripts.path), config.cli.scripts.filter)) {
        if (!args.filter || name.startsWith(args.filter)) {
          available.push(name.replace(config.cli.scripts.filter, ``))
        }
      }  
      switch (args.action) {
      case ('archive'):
        for (let name of available) {
          text = await api.fileToJSON(path.resolve(config.cli.scripts.path, name + config.cli.scripts.filter))
          store.scripts.put(name, text)
        }  
        break
      case ('backup'): 
        scriptName = await choose(available, 'Script to save (upsert) into archive')
        store.scripts.upsert(scriptName, await api.fileToJSON(path.resolve(config.cli.scripts.path, scriptName, config.cli.scripts.filter)))
        break
      case ('develop'):
        if (config.cli.ide) {
          scriptName = await choose(available, `Script to develop (opens in '${config.cli.ide}')`)
          await api.developFile(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter))
        } else api.log('warn', 'no IDE configured')
        break
      case ('edit'):
        // expect will use vim if no editor configured
        scriptName = await choose(available, `Script to edit (opens in '${config.cli.editor}'`)
        await api.editFile(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter))
        break
      case ('get'):
        scriptName = await choose(available, 'Script to display (does not touch Batch)')
        api.log('log', await api.fileToJSON(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter)))
        break
      case ('new'):
        if (config.cli.ide) {
          scriptName = await input(`New script name (opens in '${config.cli.ide}')`)
          await api.developFile(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter))
        } else api.log('warn', 'no IDE configured')
        break
      case ('restore'):
        // copy script from the collection to a file - overwriting if existing in file system
        scriptName = await choose(await store.scripts.listNames(), 'Select script to display without spoiling the Batch')
        //await api.addFile(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter))
        break
      case ('load'):
      default:
        scriptName = await choose(available, 'Select script to load to Batch cache')
        await api.fileToBatch(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter))
        break
      }
    }
    catch(err) {
      api.log('error',`(command script) error`)
      api.log('error', api.format(err))
    }
  })

vorpal.command(`settings`, `Configuration Settings`)
  .option(`-e, --edit`, `Edit ${api.name} 'config.json' file with '${config.cli.editor}'`)
  .option(chalk`-m, --mssqlconf [mssql-conf-key[value] | {underline f}ile]`, `Target Container's mssql-conf.py utility or mssql.conf out file`)
  .option(`-n, --npm`, `NPM outdated?`)
  .action( async args => {
    switch(true) {
    case (args.options.edit):
      await api.editFile(`config/config.json`)
      break
    case (args.options.app===true):
      api.log('log', await api.fileToJSON('config/config.json'))
      break
    case (args.options.npm):
      api.log('confirm', 'checking npm for outdated anonym app packages...')
      api.log('log', await api.checkNPM())
      break
      // ??? appears this might work this way as long as host's python happy using container's mssql-conf.py ??? 
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
    case (args.options.current):
    default:
      api.log('log', config)
      break
    }
  })

vorpal.command(`sqlcmd [action]`, chalk`Run queries via {bold.italic sqlcmd} from mssql-tools on Target`)
  .autocomplete(['exec', 'flags', 'input', 'session', 'spexec'])
  .option('-o, --output', 'Save output to a file in staging')
  .option(`-?, --usage`, 'echo the standard sqlcmd command-line usage message')
  .action( async args => {
    if (await api.isHost()) {
      let containerId = await choose(api.listInstanceIds('up'), 'Choose sqlcmd target instance', api.sqlCatalog.Instance)
      if (containerId) {
        let cmdArgs = [] // populated from config.sqlcmd
        let sqlArg = ''  
        let tsql = `"${api.compile(config.sqlcmd.prebatch)}\nGO\n${api.compile(config.sqlcmd.prefix)}\n${api.compile()}"`
        switch(args.action) {
        case ('spexec'): 
          sqlArg=`-Q` 
          tsql= `${api.compile(config.sqlcmd.prebatch)}\nGO\n"${api.compile(config.sqlcmd.prefix)} exec sp_executesq('${api.compile()}')"`
          break
        case (args.input):
          sqlArg=`-i "${path.resolve(config.docker.bindings.staging.mount.Target)}`
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
          Object.keys(config.sqlcmd.switch).forEach( key => {
            cmdArgs.push(`-${key}`)
            if (config.sqlcmd.switch[key]!==key) {
              cmdArgs.push(config.sqlcmd.switch[key])
            }
          })
          let result = await api.shell(containerId, `sqlcmd ${cmdArgs.join(' ')} ${sqlArg}`, tsql)
          api.batch.splice(0)
          if (args.options.output) {
            let suggestedName = path.resolve(config.cli.scripts.path, `outfile_${(new Date()).toISOString()}`)            
            api.writeResults(await input('Host file where output is to be stored', suggestedName), result) 
          }
        }
      }
    }
  })

vorpal.command(`sqlpad [action]`, chalk`httpd queries and results in a V8 browser - (requires root)`)
  .autocomplete(['configure', 'status', 'start', 'stop'])
  .action( async args => {
    switch (args.action) {
    case ('configure'):
      api.editFile(`config/sqlpad.json`)
      .then( async () => {
        if (sqlpad.sqlpad) { 
          sqlpad.sqlpad.kill(1)
          await api.startSQLPad()
        }  
      })
      break
    case ('start'):
      await api.startSQLPad()
      break
    case ('stop'):
      if (sqlpad.sqlpad) {
        sqlpad.sqlpad.kill(1)
      }  
      break
    case ('status'):  
    default:
      if (!sqlpad.sqlpad) {
        api.log('log', chalk`SQLPad web server not attached, try {bold.italic sqlpad start}`)
      } else {
        api.log('log', `SQLPad Server is Running  
          PID: ${sqlpad.sqlpad.pid}
          URI: ${config.sqlpad.protocol}://${sqlpad.ip}:${sqlpad["https-port"]}`)
      }
      break
    }
  })

// extension added only when 'test' literal passed as arg at start: 'node server.js test' or 'npm start test'
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
  .action( async args => {
    if (api.sqlCatalog.Pools.has(api.sqlCatalog.Instance)) {
      await api.openInstance(api.sqlCatalog.Instance, args["db-name"])
    }
  })

vorpal.catch('[tsql...]')
  .description(api.cliAid()) // assigns to --help
  .action( async () => {
    api.batch.push((await store.lines.getLast()).line)
  })
  
api.genCA()
  .then( async () => {
    await api.intern()
    if (!api.sqlCatalog.Instance) {
      api.log('log', api.format(api.cliAid()))
    }
    if (config.sqlpad.runAtStartup) {
      await api.startSQLPad()
    }
  })
  .catch( err => {
    api.log('error', api.format(err))
  })
  .finally( () => {
    module.exports = exports = vorpal
      .delimiter(api.delimiter) 
      .show()
  })

  
  