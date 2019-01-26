//// NPM
const chalk = require('chalk')
const vorpal = require('vorpal')()
const inquirer = require('inquirer')
//// core
const path = require('path')
//// local
const { name } = require('../package.json')
const api = require('../lib/api')
const catalog = require('./catalog')  
const { log, format } = require('../lib/log')
const { run, isSQL, go, stream } = require('../lib/sqldb')
const { errors, lines, pools, scripts, templates } = require('../lib/store')
const { genCA, genCertificate, hotelJuliet} = require('../lib/tls')

const config = require('../config/config.json')
const { sqlpad, startSQLPad } = require('../config/sqlpad.json')

module.exports = exports = vorpal
  .delimiter(api.delimiter) 
  .show()

  // socket.io-client errors
vorpal.on('client_error', err => {
  log('error', chalk`{magenta [client_error]}\n${format(err)}`)
  errors.put(JSON.stringify(err))
})

vorpal.on('client_prompt_submit', data => {
  if (data!=='') {
    lines.put(data)
  }
})

vorpal.on('client_command_error', err => {
 log('error', chalk`{magenta [client_command_error]}\n${format(err)}`)
  errors.put(JSON.stringify(err))
})

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
          resolve(log('error', `(choose) ${err}`))
        })  
    }
    catch(err) {
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
          resolve(log('error',`(input) promise\n${format(err)}`))  
        }) 
    }
    catch(err) {
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
          resolve(log('error',`(secret)\n${format(err)}`))  
        }) 
    }
    catch(err) {
      reject(err)
    }    
  })
  
} 

vorpal.command(`about [topic]`, chalk`About ${name}`)
  .autocomplete(['cli', 'icons', 'readme', 'tests', 'version'])
  .action( async args => {
    try {
      switch (args.topic) {
        case ('cli'):
          log('log', api.commandAid(vorpal.commands))
          break
        case ('icons'):
          log('log', chalk.underline.bold`icon  mode`)
          log('log', chalk`{bold \u2042}     catalog`)
          log('confirm', '   confirm')
          log('debug', `   debug  ${config.cli.log.debug?'':chalk.red('NOT ENABLED')}`)
          log('error', `   error`)
          log('info', `   info`)
          log('log', `      log`)
          log('log', chalk`{rgb(255, 136, 0) \u2A1D}     sqldb`)
          if (config.cli.log.elevations) log('log', chalk`{bold.yellow ${"\u{1F934}"}}    {magenta sudo}`)
          log('test', `  test  ${process.argv[2]==='test'?'':chalk.red('NOT ENABLED')}`)
          log('warn', `   warn`)
          break
        case ('readme'):
          if (args.options.edit) { 
            await api.editFile('README.md')
          } else {
            log('log', await api.fileToJSON('./README.md'))
          }  
          break
        case('tests'):
          log('log', await api.fileToJSON('./docs/test.md'))
          break  
        case('version'):
          log('log', api.bandAid())
          break  
        default:
          log('log', api.cliAid())
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
      log('log', 'batch is reset')
      break
    case ('sqlcmd'):
      // prebatch
      log('log', chalk`${config.cli.odbc.path}/sqlcmd
            ${api.compile(config.sqlcmd.switch)} 
            {bold -[i|q|Q]} "${api.compile(config.sqlcmd.prefix)} \n${api.compile()}"`)
      break
    case ('mssql'):
    default:
      log('log', api.batch.join().length>0?api.compile():'nothing in cache')
      break
    }
  })

vorpal.command(`catalog [action]`, chalk`Local {bold ${config.docker.sql.name}} per Container Metadata Map`)
  .autocomplete(['all', 'container', 'image', 'network', 'pool', 'remap', 'summary'])
  .action( async args => {
    let id, status
    if (await catalog.isHost()) {
      switch(args.action) {
      case ('all'):
        log('log', chalk.inverse(`SQL Server Images Pulled`.padEnd(26).padStart(30)))
        log('log', catalog.listImages())
        log('log', chalk.inverse(`Containers Created`.padEnd(26).padStart(30)))
        log('log', catalog.listInstances())
        log('log', chalk.inverse(`Pools Opened`.padEnd(26).padStart(30)))
        log('log', catalog.listPools())
        log('log', chalk.cyan.inverse(`Target Pool`.padEnd(26).padStart(30)) + chalk`{cyan ${catalog.sql.Instance}}`)
        break
      case ('container'):
        id = await choose(Array.from(catalog.sql.ContainerInfos.keys()), 'Select a container')
        log('log', await catalog.getInstanceInfo(id))
        break
      case ('image'):
        id = await choose(Array.from(catalog.sql.Images.keys()), 'Select an image')
        log('log', await catalog.getImage(id))
        break
      case ('network'):
        log('log', catalog.getAddress())
        break
      case ('pool'):
        id = await choose(Array.from(catalog.sql.Pools.keys()), 'Select a pool')
        log('log', await catalog.listPools(id))
        break
      case ('remap'):
        await catalog.intern()
        break
      case ('summary'):
      case (undefined):
        if (catalog.sql.Images) {
          log('log', chalk.inverse(`Images Pulled`.padEnd(26).padStart(30)))
          for (let [id, image] of catalog.sql.Images) {
            id===catalog.sql.Instance && catalog.getInstanceInfo(id).ImageID.includes(id)? chalk.cyan.bold(`${id}`): id 
            log('log', `${id}  (v.${image.Labels["com.microsoft.version"]})  ${image.RepoTags? image.RepoTags[0]: ""}`)
          }
          log('log', chalk.inverse(`Containers Created`.padEnd(26).padStart(30)))
          for (let info of catalog.sql.ContainerInfos) {
            id = info[0]===catalog.sql.Instance? chalk.cyan.bold(`${info[0]}`): info[0] 
            status = info[1].State!=='running'? chalk.red(info[1].Status): chalk.green(info[1].Status)
            log('log', `${id}  v.${info[1].Labels["com.microsoft.version"].padEnd(14)}  ${info[1].Names[0].padEnd(20)}  ${status}`) 
          }
          log('log', chalk.inverse(`Pools Opened`.padEnd(26).padStart(30)))
          for (let [poolId, pool] of catalog.sql.Pools) {
            id = poolId===catalog.sql.Instance? chalk.cyan.bold(`${poolId}`): poolId 
            log('log', `${id} using '${pool.pool.database}' as '${pool.pool.user}' on port ${pool.pool.port}`)
          }
        }  
        break
      default:
        log('warn', 'Invalid or missing action argument')       
        break  
      }
    }
  })

vorpal.command(`certificate [socket-name]`, chalk`TLS Credentials (requires root)`)
  .autocomplete(['docker', 'sqlpad', 'sqlserver'])
  .option('-c, --clientAuth', chalk`Use for CLI TLS Client Authentication (default is 'serverAuth') `)
  .option(`-h, --hotelJuliet`, chalk`Removal of all credentials & generate a new 'ca'`)
  .action( async args => {
    if (args.options.hotelJuliet) {
      hotelJuliet()
    } else if (['docker', 'sqlpad', 'sqlserver'].includes(args["socket-name"])) {
      if (args.options.clientAuth) {
        await genCertificate(args["socket-name"]+'CLI', 'clientAuth')
      } else {
        await genCertificate(args["socket-name"], 'serverAuth')
      }
    } else {
      log('log', (await api.listFiles(config.docker.bindings.private.mount.Source, args["socket-name"] || '.pem')).join('\n'))
    }
  })

vorpal.command(`container [action]`, chalk`{bold ${config.docker.sql.name}} Containers`)
  .autocomplete(['all','bash','close', 'delete', 'full','last', 'modem','name','open', 'processes', 'restart','start','stop','target'])
  .option(chalk`-s, --sync`, `Syncronize Catalog with actual Docker state (same as {bold catalog remap})`)
  .action( async args => {
    if (args.options.sync) await catalog.intern()
    if (await catalog.isHost()) {
      let containerId
      switch(args.action) {
      case ('all'):
        log('log', catalog.listInstances('all'))
        break
      case ('bash'):
        containerId = await choose(catalog.listInstanceIds('up'), 'Choose container to be opened in shell', catalog.sql.Instance)
        log('info', chalk`${name} Event loop suspended!`)
        await api.interactiveShell(containerId)
        break
      case ('close'):
        containerId = await choose(catalog.listPools(), 'Choose container of connection pool to close', catalog.sql.Instance)
        await closeInstance(containerId)
        log('confirm', chalk`Closed ${containerId}`)
        await catalog.intern() 
        break
      case ('delete'):
        containerId = await choose(catalog.listInstanceIds('idle'), 'Choose a stopped container to delete')
        await catalog.removeInstance(containerId)
        log('confirm', chalk`Deleted ${containerId}`)
        await catalog.intern() 
        break
      case ('full'): 
        containerId = await choose(catalog.listInstanceIds('all'), 'Choose container object to show', catalog.sql.Instance)
        log('log', catalog.getInstanceInfo(containerId))
        break
      case ('last'):
        // how many?
        log('log', await catalog.latestInstances(2))
        break
      case ('modem'):
        containerId = await choose(catalog.listInstanceIds('all'), 'Choose container object to show', catalog.sql.Instance)
        log('log', await catalog.getDAPIContainer(containerId))
        break
      case ('name'):
        containerId = await choose(catalog.listInstanceIds('all'), 'Choose container to name', catalog.sql.Instance)
        let newName = await input(`New Name for Container '${containerId}' old name: ${catalog.sql.ContainerInfos.get(containerId).Names[0]}?`)
        catalog.renameInstance(containerId, newName)
        await catalog.intern()
        break
      case ('open'):
        for (let pool of Array.from(catalog.sql.Pools.keys())) {
          running.splice(running.indexOf(pool),1)
        }  
        containerId = await choose(catalog.listInstanceIds('up'), 'Choose container to open', catalog.sql.Instance)
        await api.openInstance(containerId) //, cfg.database, cfg.user, cfg.password) 
        break
      case ('processes'):
        containerId = await choose(catalog.listInstanceIds('all'), 'Choose container object to show', catalog.sql.Instance)
        log('log', await catalog.getProcesses(containerId))
        break
      case ('restart'):
        containerId = await choose(catalog.listInstanceIds('up'), 'Choose container to restart', catalog.sql.Instance)
        await catalog.restartInstance(containerId)
        if (await catalog.intern() && catalog.sql.Instance===containerId) {
          await api.openInstance(containerId)           
        }
        break
      case ('start'):
        containerId = await choose(catalog.listInstanceIds('idle'), 'Choose container to start', catalog.sql.Instance)
        await catalog.startInstance(containerId)        
        if (await catalog.intern() && catalog.sql.Instance===containerId) {
          await api.openInstance(containerId)           
        }
        break
      case ('stop'):
        containerId = await choose(catalog.listInstanceIds('up'), 'Choose container to stop', catalog.sql.Instance)
        await catalog.stopInstance(containerId)
        await catalog.intern()
        break
      case ('target'):
        containerId = await choose(catalog.listInstanceIds('all'), 'Choose target container for CLI queries')
        if (containerId!=catalog.sql.Instance) {
          if (await catalog.intern(containerId)) {
            await api.openInstance(containerId)           
          }
        }
        break
      default:  
        log('log', `Target Container: ${catalog.sql.Instance}`)
        break
      }
    }
  })

vorpal.command(`engine [action]`, chalk`Docker Container Engine systemd controller (requires root)`)
  .autocomplete(['start', 'stop', 'reload', 'restart', 'try-restart', 'force-reload', 'status'])
  .action( async (args) => {
    if (['start', 'stop', 'reload', 'restart', 'try-restart', 'force-reload', 'status'].includes(args.action)) {
      let action = args.action || 'status'
      await api.setEngine(action)
    } else {
      log('warn', `Invalid request`)
    }
  })

vorpal.command(`file [type]`, chalk`List Files by class {bold within} a SQL Container`)
  .autocomplete(['agent', 'backup', 'dump', 'data', 'errorlog', 'log', 'private', 'staging'])
  .option('-b, --browse', ``)
  .action( async args => {
    if (await catalog.isHost()) {
      let folder
      let filter
      let containerId = await choose(catalog.listInstanceIds('up'), 'Choose container', catalog.sql.Instance)
      if (catalog.sql.ContainerInfos.has(containerId) &&
        catalog.sql.ContainerInfos.get(containerId).State==='running') {
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
        await mssqlFiles(containerId, folder, filter)
      }
    }
  })

vorpal.command('go', `Execute the Batch on the Target SQL Server using mssql.Request.query()`)
  .action( async () => {
    try {
      let result
      let query = api.compile(api.batch)
      if (catalog.sql.Pools.has(catalog.sql.Instance)) {
        result = await go(query.trim(), catalog.sql.Instance)
        if (result.recordsets.length>0) {
          for (let rs of result.recordsets) {
            log('log', rs)
          }
        }  
        else if (result.recordset) log('log', result.recordset)
        else log('info', result)
        if (result.rowsAffected[0]>0) log('log', `rowsAffected: ${result.rowsAffected}`)
        api.batch.splice(0)
      } 
    }
    catch (err) {
      log('error', err)
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
        log('error', syntaxError)
        return false
      }
    }
    try {
      log('info', chalk`Query builder for CLI nedb object store with MongoDB API.
      The {bold find}, {bold projection} and {bold sort} objects must be input as
      well-formed JSON (JSON.stringify(obj)).  
      Hit {bold Ctrl}{bold -C} to abort the Query Builder.`)
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
      log('log', await store.search(collection, JSON.parse(find), JSON.parse(projection), JSON.parse(sort), limit, skip))
    }
    catch(err) {
      log('error', err)
    }
  })

vorpal.command(`image [action]`, chalk`Local '${config.docker.pull.repo}' Dockerhub Images`)
  .autocomplete(['all', 'full', 'pull', 'run'])
  .action( async args => {
    let imageId 
    if (await catalog.isHost()) {
      switch (args.action) {
      case ('all'):
        log('log', catalog.listImages())
        break
      case ('pull'):
        let repos = [config.docker.pull.repo, config.docker.pull.lastRepo, config.docker.pull.nextRepo]
        let tags = [config.docker.pull.tag, config.docker.pull.lastTag, config.docker.pull.nextTag]
        let repo = await choose(repos, 'Select or enter a docker hub repository to access', config.docker.pull.repo)
log('confirm', `image repo ${repo}`)
        let tag = await choose(tags, 'Select or enter the image tag to fetch', config.docker.pull.tag)
log('confirm', `image repo ${tag}`)
        log('log', await catalog.pullImage(repo, tag))
        break
      // case ('rm'): only if dangling and sql
      case ('run'):
        // user can be changed later and sa disabled, but for now we need an sa
        imageId = await choose(Array.from(catalog.sql.Images.keys()), 'Select Image to run')
        config.mssql.env.MSSQL_SA_PASSWORD = await input(`'sa' password`, config.mssql.env.MSSQL_SA_PASSWORD)
        await catalog.runImage(imageId)
        break
      case ('full'):
        imageId = await choose(Array.from(catalog.sql.Images.keys()), 'Select an image to show')
        log('log', await catalog.getImage(imageId))
        break
      default:
        imageId = catalog.sql.ContainerInfos.get(catalog.sql.Instance).ImageID
        log('log', await catalog.getImage(imageId))
        break
      }
    }
  })

vorpal.command(`issql`, chalk`Evaluate Batch cache as TSQL on Target - uses {bold SET NOEXEC ON} prefix`)
  .action( async () => {
    if (api.batch.join().length>0) {
      if (await catalog.isHost()) {
        if (await isSQL(api.compile(), catalog.sql.Instance)) {
          log('log', chalk`{bold.green \u2713} valid t-SQL according to ${catalog.sql.Instance}`)
        }
      }
    }
  })

vorpal.command(`log [scope]`, chalk`Container's Logs - defaults to active SQL Server errorlog`)
  .autocomplete(['docker', 'sql', 'agent']) 
  .option(`-a, --archive [extension-number]`, `Numeric extension of a Past Physical SQL log file for 'sql' and 'agent' scope`)
  .option(`-m, --match [match-string]`, `Return logs that contain 'match-string' - applied before --search`)
  .option(`-s, --search [search-string]`, `Search matches for logs also containing 'search-string'- applied after --match`)
  .option(`-t, --tail [number-of-rows]`, `Limit rows returned (from end of file - default is 'all' rows in file)`)
  .action( 
    async args => {
      try {
        if (await catalog.isHost()) {
          let containerId = await choose(catalog.listInstanceIds('up'), 'Choose container', catalog.sql.Instance)    
          switch (args.scope) {
            case ('docker') :  
              let since 
              let Status = catalog.sql.ContainerInfos.get(containerId).Status.split(' ')
              if (args.options.archive) log('warn', chalk`Ignoring {bold --archive ${args.options.archive}}`)      
              if (Status[0]==='Up') { 
                switch (Status[3]) {
                  case('seconds'):
                    log('confirm', `${Status[2]}s`)
                    since = '2d'
                    break
                  case('hours'):
                    log('confirm', `${Status[2]}h`)
                    break
                  case('days'):
                    log('confirm', `${Status[2]}d`)
                    break
                  default:  
                     await catalog.tailLog(containerId, 'all', true, false, since)
              }
            }  
            break
          case ('sql') :
            log('log', await go(`EXEC sys.xp_readerrorlog ${args.options.archive||0}, 1, ${args.options.match}, ${args.options.search}`), containerId)
            break
          case ('agent') :
            log('log', await go(`EXEC sys.xp_readerrorlog ${args.options.archive||0}, 2, ${args.options.match}, ${args.options.search}`), containerId)
            break
          default :
            await stream(`EXEC sys.xp_readerrorlog 0, 1`, containerId) // use default tabular output rowListener
            break  
          }
        }
      }    
      catch (err) {
        log('error', `(log) ${err}`)
      }

  })

vorpal.command(`query [action] [filter]`, chalk`${name} query store`)
  .autocomplete(['archive', 'delete', 'edit', 'get', 'import', 'load', 'put', 'sync'])
  .action( async args => {
    try{
      let queryName, suggestedName
      let available = await templates.names(args.filter)
      if (!available || available.length===0) {
        templates.import()
      }
      switch(args.action) {
      case ('archive'):
        suggestedName = path.resolve(config.cli.scripts.path, `queries_export_${(new Date()).toISOString()}`)
        await api.archiveQueries(await input('Target file for queries collection export', suggestedName))
        break
      case ('delete'):
        queryName = await choose(await templates.names(args.filter), 'Query to delete')
        templates.remove(queryName)
        break
      case ('edit'):
        queryName = await choose(await templates.names(args.filter), 'Query to edit')      
        templates.upsert(queryName, await api.editText(await templates.get(queryName)))
        break
      case ('get'): // can use to refer back to existing while composing - does not touch Batch
        queryName = await choose(await templates.names(args.filter), 'query to show')
        log('log', await templates.get(queryName))
        break
      case ('import'):
        templates.import()
        log('log', 'query store is loaded from queries.js')
        break
      case ('put'):
        templates.put(await input('Name for Query in Store'), api.compile())
        break
      case ('sync'):
        await archiveQueries(path.resolve('lib/queries.js'))
        log('log', 'query store has overwritten queries.js')
        break
      case ('load'): 
      default:
        queryName = await choose(await templates.names(args.filter), 'query to load into the Batch', suggestedName)
        api.batch = (!queryName)? '': (await templates.get(queryName)).split('\n')
        break
      }
    }  
    catch(err) {
      log('error', chalk`no queries in store, try {bold query import}`)
      log('error', `${err}`)
    }  
  })

vorpal.command(`run`, `Submit Batch to Target using mssql.Request.batch()`)
  .option(chalk`-s, --showplan [{underline A}LL|{underline T}EXT|{underline X}ML]`,
    chalk`Wrap in {bold SET SHOWPLAN_ALL|TEXT|XML ON/OFF}`)
  .option(chalk`-t, --statistics [{underline I}O|{underline P}ROFILE|{underline T}IME|{underline X}ML]`,
    chalk`Wrap in with {bold SET STATISTICS IO|PROFILE|XML ON/OFF} statement to batch`)
  .action( async args => {
    let stmt
    if (await catalog.isHost()) {
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
      let results = await run(api.compile(), catalog.sql.Instance)
      for (let result of results)
      { 
        if (result.recordsets.length>0) {
          for (let rs of result.recordsets) {
            log('log', rs)
          }
        }  
        else if (result.recordset) log('log', result.recordset)
        else log('info', result)
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
          scripts.put(name, text)
        }  
        break
      case ('backup'): 
        scriptName = await choose(available, 'Script to save (upsert) into archive')
        scripts.upsert(scriptName, await fileToJSON(path.resolve(config.cli.scripts.path, scriptName, config.cli.scripts.filter)))
        break
      case ('develop'):
        if (config.cli.ide) {
          scriptName = await choose(available, `Script to develop (opens in '${config.cli.ide}')`)
          await api.developFile(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter))
        } else log('warn', 'no IDE configured')
        break
      case ('edit'):
        scriptName = await choose(available, `Script to edit (opens in '${config.cli.editor}'`)
        await api.editFile(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter))
        break
      case ('get'):
        scriptName = await choose(available, 'Script to display (does not touch Batch)')
        log('log', await api.fileToJSON(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter)))
        break
      case ('new'):
        if (config.cli.ide) {
          scriptName = await input(`New script name (opens in '${config.cli.ide}')`)
          await api.developFile(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter))
        } else log('warn', 'no IDE configured')
        break
      case ('restore'):
        scriptName = await choose(await scripts.listNames(), 'Select script to display without spoiling the Batch')
        break
      case ('load'):
      default:
        scriptName = await choose(available, 'Select script to load to Batch cache')
        await api.fileToBatch(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter))
        break
      }
    }
    catch(err) {
      log('error',`(command script) error\n'${format(err)}`)
    }
  })

vorpal.command(`settings [purpose]`, `Configurable Settings`)
  .autocomplete([`config`, `environment`, `mssqlconf`, `sqlpad`])
  .action( async args => {
    switch(args.purpose) {
    case ('config'):
      await editFile(`config/config.json`)
      break
    case ('environment'):
      // dump to screen in editor
      break
    case ('mssqlconf'):
// use the interactive below
      break
    case ('sqlpad'):
      editFile(`config/sqlpad.json`)
      .then( async () => {
        if (sqlpad) { 
          await sqlpad.kill(1)
          await startSQLPad((path.resolve(config.docker.bindings.private.mount.Source)))
        }  
      })
      break
    default:
      // may need for trace flags? otherwise use Container ENVIRONMENT VARS in config.json set only at create
      switch(true) {
        case (typeof args.options.mssqlconf==='string'):
          if (await catalog.isHost() && catalog.sql.Instance) {
            let argpair = await store.lines.getLast()
            await mssqlConf(catalog.sql.Instance, argpair.line.split(' ').slice(2).join(' '))
          }
          break
        case (args.options.mssqlconf):
          if (await catalog.isHost() && catalog.sql.Instance) {
            await mssqlConf(catalog.sql.Instance, '-h')
          }
          break
        default:
          break  
      }  
      break
    }
  })

vorpal.command(`sqlcmd [action]`, chalk`Run queries via {bold sqlcmd} from mssql-tools on Target`)
  .autocomplete(['exec', 'flags', 'input', 'session', 'spexec'])
  .option('-o, --output', 'Save output to a file in staging')
  .option(`-?, --usage`, 'echo the standard sqlcmd command-line usage message')
  .action( async args => {
    if (await catalog.isHost()) {
      let containerId = await choose(catalog.listInstanceIds('up'), 'Choose sqlcmd target instance', catalog.sql.Instance)
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
           // choose a file from staging
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
          await shell(containerId, `${path.resolve(config.cli.odbc.path, 'sqlcmd -?')}`)
          break
        }
        if (sqlArg) {
          let cfgUser = config.sqlcmd.switch.U
          config.sqlcmd.switch.U = await input(chalk`{bold SQL Server} user name`, config.sqlcmd.switch.U)
          if (config.sqlcmd.switch.U!==cfgUser || !config.sqlcmd.switch.P) {
            config.sqlcmd.switch.P = await secret(chalk`{bold SQL Server} user password`)
          } 
          config.sqlcmd.switch.d = config.mssql.pool.database
          Object.keys(config.sqlcmd.switch).forEach( key => {
            cmdArgs.push(`-${key}`)
            if (config.sqlcmd.switch[key]!==key) {
              cmdArgs.push(config.sqlcmd.switch[key])
            }
          })
          let result = await shell(containerId, `sqlcmd ${cmdArgs.join(' ')} ${sqlArg}`, tsql)
          api.batch.splice(0)
          if (args.options.output) {
            let suggestedName = path.resolve(config.cli.scripts.path, `outfile_${(new Date()).toISOString()}`)            
            writeResults(await input('Host file where output is to be stored', suggestedName), result) 
          }
        }
      }
    }
  })

vorpal.command(`sqlpad [action]`, chalk`httpd queries and results in a V8 browser - (requires root)`)
  .autocomplete([ 'status', 'start', 'stop'])
  .action( async (args, cb) => {
    switch (args.action) {
    case ('start'):
      await startSQLPad((path.resolve(config.docker.bindings.private.mount.Source)))
      break
    case ('stop'):
      if (sqlpad.sqlpad) {
        sqlpad.sqlpad.kill(1)
      }  
      break
    case ('status'):  
    default:
      if (!sqlpad.sqlpad) {
        log('log', chalk`SQLPad web server not attached, try {bold sqlpad start}`)
      } else {
        log('log', `SQLPad Server is Running  
          PID: ${sqlpad.sqlpad.pid}
          URI: ${config.sqlpad.protocol}://${sqlpad.ip}:${sqlpad["https-port"]}`)
      }
      break
    }
  })

  vorpal.command('stream', `Execute using mssql.Request.query() and stream results back`)
  .action( async () => {
    try {
      let result
      let query = api.compile(api.batch)
      if (catalog.sql.Pools.has(catalog.sql.Instance)) {
        await stream(query.trim(), catalog.sql.Instance)
        api.batch.splice(0)
      } 
    }
    catch (err) {
      log('error', err)
    }
  })

// extension added only when 'test' literal passed as arg at start: 'node server.js test' or 'npm start test'
if (process.argv.length===3 && process.argv[2]==='test') {
  const tests = require(`../tests/${process.argv[2]}`)
  vorpal.use(tests)
} 

vorpal.command(`use [database]`, `CLI Database Context - change Target's Connection Pool database`)
  .action( async args => {
    if (!args.database) {
      log('log', `database: ${(await pools.get(catalog.sql.Instance)).pool.database}`)
    } else {
      if (catalog.sql.Pools.has(catalog.sql.Instance)) {
        await api.openInstance(catalog.sql.Instance, args.database)
      }  
    }
  })
  
vorpal.catch('[tsql...]')
  .description(api.cliAid()) // assigns to --help
  .action( async () => {
    api.batch.push((await lines.getLast()).line)
})

