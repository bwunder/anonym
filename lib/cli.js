//// NPM
const chalk = require('chalk')
const vorpal = require('vorpal')()
//// core
const path = require('path')
//// local
const api = require('../lib/api')
const catalog = require('../lib/catalog')  
const { format, log } = require('../lib/log')
const repo = require('../lib/repo') 
const { run, isSQL, go, readLog, stream } = require('../lib/sqldb')
const sqlpad = require('../lib/sqlpad')
const { errors, lines, pools, scripts, templates, words } = require('../lib/store')
const { genCertificate, hotelJuliet} = require('../lib/tls')
const view = require('../lib/viewer')

const config = require('../config/config.json')

var isBash = false

if (!config.browser.command) {
  log('warn', `(config.browser.command) not set, HTML content cannot be rendered.`)
  config.browser.command = 'unavailable'
}  
if (!config.editor) {
  log('warn', `(config.editor) not set, defaulting to 'vi' for all buffer edits`)
  config.editor = 'vi'
}  
if (!config.ide) {
  log('warn', `(config.ide) not set, defaulting to 'vi' for all source file edits`)
  config.ide = 'vi'
}  

module.exports = exports = vorpal
  .delimiter(view.delimiter) 

// socket.io-client errors
vorpal.on('client_error', err => {
  err.event='client_error'
  log('error', chalk`{magenta [client_error]}\n${format(err)}`)
  errors.put(err)
})

vorpal.on('client_prompt_submit', data => {
  if (data!=='') {
    lines.put(data)
    if (isBash) vorpal.delimiter(view.delmiter)
  }
  newLine=true
})

// ??? prints mysterious "true" even with all vorpal event handlers commented out ???  

vorpal.on('client_command_error', err => {
  err.event='client_command_error'
  log('error', chalk`{magenta [client_command_error]}\n${format(err)}`)
  errors.put(err)
})

vorpal.on('keypress', key => {
  if (!key.value) { // only blank when newline
    switch (key.e.key.sequence) {
      case (`\u001bb`): // ALT+b
        isBash=true
        vorpal.ui.delimiter(`bash one-off$ `)
        break
      case (`\u001ba`): // ALT+a    
        vorpal.ui.input(`catalog `)
        break
      case (`\u001bc`): // ALT+c    
        vorpal.ui.input(`container `)
        break
      case (`\u001bn`): // ALT+n    
        vorpal.ui.input(`connection `) 
        break
      case (`\u001bq`): // ALT+q    
        vorpal.ui.input(`query `) 
        break
      case (`\u001bs`): // ALT+s    
        vorpal.ui.input(`script `) 
        break
      default:
        break
    }
  }
})

vorpal.command(`about [topic]`, chalk`Documentation by topic\n
  View topical output at the prompt (${view.dft()}) 
  or, include the {bold -b aka --browse} option to spawn the same text in the configured browser 
      * see {bold.italic config.browser} - currently '{italic ${config.browser.command}}'.
  or, use option ({bold -e aka --edit}) to open the source containing the topical output for edit in 
  the appropriate local editor: 
      * Most files are opened for edit in the user's preferred {bold.italic config.ide}, 
        currently '{italic ${config.ide}}'. CLI may require a restart to see the changes. 
      * Buffer's, JSON and run-time relevant files block the event loop while open in {bold.italic config.editor}, 
        currently '{italic ${config.editor}}'. Changes are recognized by the CLI at next use.\n 
  Topics:\n 
    {bold commands}     Index of CLI commands with brief descriptions
    {bold config}       './docs/config.md' - describes the './config/config.json' key pairs 
    {bold editor}       --help command-line output of {bold.italic config.editor}
    {bold introduction} Developing Distributed Apps with ${view.name()} and Microsoft SQL Server   
    {bold quickstart}   CLI quickstart - CLI usage and some useful commands for getting started
    {bold readme}       './README.md' file (e.g., the markdown document for the repo on github)
    {bold sqlcmd}       './docs/sqlcmdCheatSheet.html' (expands upon {bold.inverse sqlcmd -?})
    {bold test}         './docs/test.md' - describes the test strategy and enabling the test command
    {bold tls}          './docs/tls.md' - describes setup and use of TLS by the CLI
    {bold version}      The version from package.json
    {bold ucons}        Unicode codepoints used by CLI as symbols to inform the user at a glance 
    {bold usage}        ${view.dft()} CLI usage message\n`)
  .autocomplete(['commands', 'editor', 'introduction', 'quickstart', 'readme', 'sqlcmd', 'test', 'tls', 'version', 'ucons', 'usage'])
  .option(`-b, --browse`, `Open the document (as HTML) in a browser with '${config.browser.command}'`)
  .option(`-e, --edit`, chalk`Edit the source document with 'config.editor' ({yellowBright Always overrides} {bold.inverse --browse})`)
  .action( async args => {
    let content, doc, source, sourcePath
    switch (args.topic) {
      case ('commands'):
        if (args.options.browse) {
          source = [`| command | description |`, `|:---  |:--- |`]
          vorpal.commands.forEach( (cmd) => {
            if (cmd._name) source.push(`| __${cmd._name}__ | ${cmd._description.split('\n')[0]} |`)
          })
          doc = await view.markup(args.topic, source.join('\n'))
        }
        else if (args.options.edit) doc = path.resolve('./lib/cli.js')
        else {
          content = ['\n']
          vorpal.commands.forEach( (cmd) => {
            if (cmd._name) {
              content.push(chalk`{bold ${cmd._name}}`
              .padEnd(25, ' .')
              .concat(' ')
              .concat(cmd._description.split('\n')[0])
              .concat(`\n`))
            }  
          })
        }
        break    
      case('editor'):
        source = await api.shell(`${config.editor} --help`)
        if (args.options.browse) {
          doc = await view.markup(`${config.editor}.help`, `<pre>${source}</pre>`)
        }
        else if (args.options.edit) doc = path.resolve('./config/config.json')
        else content = source  
        break  
      case ('introduction'):
        path.resolve('./lib/viewer.js')
        if (args.options.browse) {
          doc = await view.markup('introduction', await view.introduction(vorpal.commands, 'www'))
        }  
        else if (args.options.edit) doc = source 
        else content = await view.introduction(vorpal.commands, 'cli')
        break
      case ('quickstart'):
        if (args.options.browse) {
          doc = await view.markup('quickstart', await view.quickstart('www'))
        }  
        else if (args.options.edit) doc = path.resolve('./lib/viewer.js')
        else content = await view.quickstart('cli')
        break
      case ('readme'):
        sourcePath = path.resolve('./README.md')
        if (args.options.browse) {
          doc = await view.markup(sourcePath)
        }
        else if (args.options.edit) doc = sourcePath
        else content = await api.fileToJSON(sourcePath)   
        break
      case ('sqlcmd'):
        sourcePath = path.resolve('./docs/sqlcmdCheatSheet.ods')
        if (args.options.browse) doc = path.resolve(config.cli.docs.path, 'html/sqlcmdCheatSheet.html')
        else if (args.options.edit) doc = sourcePath
        else {
          content = `Review the './docs/sqlcmdCheatSheet.ods' spreadsheet with LibreOffice or 
          browse ./docs/html/sqlcmdCheatSheet.html and view the source. 
          Viewing HTML in a bash terminal is Webster's third definition of insanity.`
        } 
        break
      case('test'):
      case('tls'):
        sourcePath = path.resolve(config.cli.docs.path, `${args.topic}.md`)       
        if (args.options.browse) doc = await view.markup(sourcePath)
        else if (args.options.edit) doc = sourcePath
        else content = await api.fileToJSON(sourcePath)
        break  
      case ('ucons'):
        if (args.options.browse) {
          // dynamic markdown, whoo-hoo
          source =[`| intent | symbol |`, `|:--- |:--- |`]
          for (let intent in config.cli.ucons) {
            let ucon = config.cli.ucons[intent]            
            if (ucon.style) source.push(`| ${intent} | ${view.style(`{${ucon.style} ${String.fromCodePoint(ucon.codepoint)}}`, 'www')} |`)
            else if (ucon.codepoint) source.push(`| ${intent} | ${String.fromCodePoint(ucon.codepoint)} |`)
            else source.push(`| ${intent} |  |`) // log and progress are blank
          }   
          doc =  await view.markup(args.topic, source.join('\n'))       
        }  
        else if (args.options.edit) doc = path.resolve('./config/config.js')
        else {
          content = [chalk`\n${chalk.underline(`intent`).padEnd(30)} {underline symbol}\n`]
          view.ucons.forEach( (ucon, intent) => {
            content.push(intent.padEnd(25, ' .').concat(ucon).concat(`\n`))
          })
        }
        break  
      case('version'):
        if (args.options.browse) {
          doc = await view.markup('version', await view.markup('version', '\t'))
        } 
        else if (args.options.edit) doc = path.resolve('./package.json')
        else content = ''
        break  
      case('usage'):
      default:
        if (args.options.browse) {
          doc = await view.markup('usage', await view.usage('www'))
        } 
        else if (args.options.edit) doc = path.resolve('./lib/viewer.js')
        else content = await view.usage('cli')
        break
    } 
    if (args.options.browse) await api.spawnTask(`${config.browser.command} ${doc}`)
    else if (args.options.edit) await api.spawnTask(`${config.ide} ${doc}`)
    else {
      log('log', view.header())
      log('log', content)
    }  
  })

vorpal.command(`batch [action]`, chalk`Current query buffer cache\n
  Actions:\n 
    {bold edit}   open and edit the cached query with {bold ${config.editor}}
    {bold issql}  send the cached query to the Target instance to verify as TSQL {bold SET NOEXEC ON}
    {bold reset}  clear the cache of all text (e.g. {bold batch.splice(0)})
    {bold sqlcmd} display the cached query and sqlcmd switches as if submitted via sqlcmd {bold ODBC}
    {bold tds}    (${view.dft()}) display the cached query as if submitted via mssql {bold TDS}\n 
  The {bold batch} command never queries or changes SQL Server database data         
  Use commands {bold 'go'}, {bold 'run'}, {bold 'stream'} or {bold 'sqlcmd'} to submit cached query for execution.\n`)
  .alias('?')
  .autocomplete(['edit', 'issql', 'reset', 'sqlcmd', 'tds'])
  .action( async args => {
    switch(args.action) {
    case ('edit'):
      api.batch = (await api.editText(api.compile())).split('\n')
      break
    case ('issql'):
      if (api.batch.join().length>0) {
        if (await catalog.isHost()) {
          if (await isSQL(api.compile(), catalog.sql.Instance)) {
            log('confirm', chalk`TSQL is valid according to ${catalog.sql.Instance}`)
          }
        }
      }
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
    case ('tds'):
    default:
      log('log', api.batch.join().length>0?api.compile():'nothing in cache')
      break
    }
  })

vorpal.command(`catalog [action]`, chalk`Stateful Inventory of Managed SQL Instances\n
  The catalog is a runtime Object of Maps of Docker {bold ${config.mssql.repo.path}} Objects 
  along with this CLI's SQL connections to any of the running SQL Servers in the catalog.\n
  Actions:
    {bold all}       Map of local SQL Images and Containers
    {bold container} Mapped Containers
    {bold image}     Mapped Images
    {bold network}   IP map of running Containers
    {bold pool}      Currently opened SQL Connections
    {bold remap}     Reinventory
    {bold summary}   (${view.dft()}) Terse catalog summary\n`)
  .autocomplete(['all', 'container', 'image', 'network', 'pool', 'remap', 'summary'])
  .action( async args => {
    if (await catalog.isHost()) {
      switch(args.action) {
      case ('all'):
        log('log', chalk.inverse(`SQL Server Images Pulled`.padEnd(26).padStart(30)))
        log('log', catalog.listImages())
        log('log', chalk.inverse(`Containers Created`.padEnd(26).padStart(30)))
        log('log', catalog.listInstances())
        log('log', chalk.inverse(`Pools Opened`.padEnd(26).padStart(30)))
        log('log', catalog.listPools())
        break
      case ('container'):
        log('log', await catalog.getInstanceInfo(await catalog.chooseInstanceId('all')))
        break
      case ('image'):
        log('log', await catalog.getImage(await catalog.chooseImageId()))
        break
      case ('network'):
        log('log', catalog.getAddress())
        break
      case ('pool'):
        log('log', chalk.inverse(`Pools Opened`.padEnd(26).padStart(30)))
        log('log', catalog.listPools(await catalog.choosePoolId()))
        break
      case ('remap'):
        await catalog.intern()
        break
      case ('summary'):
      case (undefined):
        if (catalog.sql.Images) {
          await catalog.paintImagesSummary() 
          await catalog.paintInstancesSummary() 
          catalog.paintPoolsSummary() 
        }  
        break
      default:
        log('warn', `Unknown repo action: ${args.action}`)
        break
      }
    }  
  })      

vorpal.command(`connection [action]`, chalk`CLI to SQL Server Connection Pools\n
  Work with the CLI's collection of open tedious.js connections to running SQL Containers. The CLI 
  prompt uses one pool at a time: the designated {bold target}. Once a {bold target} is set, the CLI will try 
  to reconnect to that {bold target} at start-up. However, a new TDS pool can be instantiated or an exisiting 
  pool can be reattached with {bold.inverse connection open} or when the user sets the target (e.g., {bold.inverse connection target}). 
  In either situation, any pools opened previous in the current CLI session will remain open until the CLI is 
  exited, the pool is closed (e.g., {bold.inverse connection close}) or the pool is archived (e.g., {bold.inverse connection forget}). 
  The user can re-target any open pool that appears in the catalog at any time during the current CLI session 
  (e.g., {bold.inverse connection target}). 
  
  The current Batch cache contents can be directed toward an open pool other than the target by 
  using the ({bold --pool} option of any {yellowBright Terminating} command: (e.g., {bold.inverse go}, {bold.inverse run} or {bold.inverse stream})\n     
  Actions:\n  
             (${view.dft()})  View the Currently in use Pool Target for CLI queries
    {bold close}      Close a Connection Pool
    {bold edit}       Modify a Connection Pool Config
    {bold forget}     Forget a Connection Pool Config (will not be reused)
    {bold open}       (Re)Open a connection Pool to a running Container
    {bold target}     Set a Container as the Target of CLI queries\n`) 
  .autocomplete(['close', 'edit', 'forget', 'open', 'options', 'target'])
  .action( async args => {
    if (await catalog.isHost()) {
      let containerId
      switch(args.action) {
        case ('close'):
          containerId = await catalog.choosePoolId()
          await catalog.closeInstance()
          await catalog.intern()
          break
        case ('edit'):
          // load the nedb record into emacs DO NOT USE BATCH - like 'settings config' or 'script get'
          api.editText(await store.pools.get(await catalog.choosePoolId()))
          .then( (containerId, pool) => {
            store.pools.update(containerId, pool)
          })
          break
        case ('forget'):
          containerId = await catalog.choosePoolId()
          await catalog.closeInstance(containerId)
          store.pools.archive(containerId)
          await catalog.intern()
          break
        case ('open'):
          // resist double pooling an instance from cli by removing already pooled from choices
          const poolFilter = (available) => {
            for (let pool of Array.from(catalog.sql.Pools.keys())) {
              available.splice(available.indexOf(pool),1)
            }  
          }
          containerId = await catalog.chooseInstanceId('up', poolFilter)
          break
        case ('target'):
          await catalog.intern(await catalog.chooseInstanceId('up')) 
          break
        default:  
          log('log', `Target Container: ${catalog.sql.Instance}`)
          break
      }
    }
  })

vorpal.command(`container [action]`, chalk`SQL Containers built from Microsoft's images on Docker Hub\n
  Actions:\n  
    {bold all}        Docker API object of all Containers in the catalog
    {bold bash}       Open a bash shell prompt inside a Container
    {bold commit}     Save a Container as an Image (for redeployment)
    {bold delete}     Delete a stopped Container   
    {bold full}       (${view.dft()})  Show a Container's Docker API object
    {bold inspect}    Inspect the Docker Container
    {bold last} [2]   The last Container(s) created
    {bold name}       Add or Change a Container's name
    {bold new}        Instantiate a Container (same as {bold.inverse image run})
    {bold processes}  Show a Container's active processes    
    {bold restart}    Restart a Container
    {bold start}      Start an idle Container
    {bold stop}       Stop a running Container\n
  This command is ALT key aware. Pressing '{bold ALT+c}' on a new line autofills the command's name\n`) 
  .autocomplete(['all', 'bash', 'delete', 'inspect', 'full', 'last', 'name', 'new', 'processes', 'restart', 'start', 'stop'])
  .action( async args => {
    if (await catalog.isHost()) {
      switch(args.action) {
        case ('all'):
          log('log', catalog.listInstances())
          break
        case ('bash'):
          await api.interactiveShell()
          break
        case ('commit'):
          await catalog.commitContainer()
          break
        case ('delete'):
          await catalog.removeInstance()
          break
        case ('inspect'):
          log('log', await catalog.inspectContainer())
          break
        case ('last'):
          if (Number.isNaN(args.last)) 
          log('log', await catalog.latestInstances(Number.isNaN(args.last)? 2: args.last))
          break
        case ('name'):
          catalog.renameInstance()
          break
        case ('new'):
          await catalog.runImage()
          break
        case ('processes'):
          log('log', await catalog.getProcesses())
          break
        case ('restart'):
          await catalog.restartInstance()
          break
        case ('start'):
          await catalog.startInstance()
          break
        case ('stop'):
          await catalog.stopInstance()
          break
        case ('full'): 
        default:  
          log('log', await catalog.getInstanceInfo())
          break
      }
    }  
  })

vorpal.command(`engine [action]`, chalk`dockerd - Self-sufficient runtime for containers\n
  Actions:\n
    {bold force-reload}      Reload config - may restart the daemon
    {bold reload}            Reload config - will not restart the daemon
    {bold restart}           Restart the running daemon and, by default, the current Target Instance
    {bold start}             Start the now stopped daemon and, by default, the current Target Instance
    {bold.bgMagenta status}  (${view.dft()}) Status of the daemon
    {bold stop}              Stop the running daemon - stops all running containers 
    {bold try-restart}       Restart the running daemon and Target Instance else just report success.
  \n`)   
  .autocomplete(['force-reload', 'reload', 'restart', 'start', 'status', 'stop', 'try-restart'])
  .option(`-a, --all`, `Start all instances after the engine is started or restarted`)
  .option(`-n, --none`, `For start or restart actions, do not start/restart any instances.`)
  .option(`-r, --running`, `Restart all running instances after engine restart (no-op if not engine restart)`)
  .option(`-t, --target`, `${view.dft()} For start or restart actions, also start/restart the Target Instance`)
  .action( async (args) => {
    const action = args.action || 'status'
    const option = Object.keys(args.options)[0] || 'target'
    if (!args || ['force-reload', 'reload', 'restart', 'start', 'status', 'stop', 'try-restart'].includes(action)) {
      await api.setEngine(action, option)
    } else {
      log('warn', `Invalid request`)
    }
  })

vorpal.command(`files [type]`, chalk`List Files by class in the SQL Container selected\n
  Types:\n
    {bold agent}      SQL Agent logs in Container folder '${config.mssql.env.MSSQL_ERRORLOG_DIR}'
    {bold backup}     SQL Backups ('.bak' files) in Container folder '${config.mssql.env.MSSQL_BACKUP_DIR}'
    {bold bin}        SQL Executables in Container folder '${config.mssql.env.MSSQL_BIN_DIR}'
    {bold dump}       SQL Dump files in Container folder '${config.mssql.env.MSSQL_DUMP_DIR}'
    {bold data}       SQL Data files (.mdf) in Container folder '${config.mssql.env.MSSQL_DATA_DIR}' 
    {bold errorlog}   (${view.dft()}) SQL Errorlog logs in Container folder '${config.mssql.env.MSSQL_ERRORLOG_DIR}'  
    {bold log}        SQL Log files (.ldf) in Container folder '${config.mssql.env.MSSQL_LOG_DIR}' 
    {bold private}    Contents of Container private folder '${config.mssql.env.PRIVATE_DIR}' 
    {bold staging}    Contents of Container staging folder '${config.mssql.env.STAGING_DIR}'\n`)
  .autocomplete(['agent', 'backup', 'bin', 'dump', 'data', 'errorlog', 'log', 'private', 'staging'])
  .option('-b, --browse', ``)
  .action( async args => {
    if (await catalog.isHost()) {
      let folder
      let matchPattern
      let containerId = await catalog.chooseInstanceId('up')
      switch(args["type"]) {
      case ('agent'):
        folder=config.mssql.env[`MSSQL_ERRORLOG_DIR`]
        matchPattern='sqlagent'
        break
      case ('backup'):
        folder=config.mssql.env[`MSSQL_BACKUP_DIR`]
        matchPattern='.bak'
        break
      case ('bin'):
        folder=config.mssql.env[`MSSQL_BIN_DIR`]
        matchPattern=''
        break
      case ('dump'):
        folder=config.mssql.env[`MSSQL_DUMP_DIR`]
        matchPattern='core'
        break
      case ('data'):
        folder=config.mssql.env[`MSSQL_DATA_DIR`]
        matchPattern='.mdf'
        break
      case ('log'):
        folder=config.mssql.env[`MSSQL_LOG_DIR`]
        matchPattern=`.ldf`
        break
      case ('private'):
        folder=config.mssql.env[`PRIVATE_DIR`]
        matchPattern=''
        break
      case ('staging'):
        folder=config.mssql.env[`STAGING_DIR`]
        matchPattern=''
        break
        case ('errorlog'):
        default:
          folder=config.mssql.env[`MSSQL_ERRORLOG_DIR`]
          matchPattern='errorlog'
          break
      }
      if (matchPattern) {
        folder = await api.input('Path in container to search', folder)
        matchPattern = await api.input(`Find files matching`, matchPattern)
        await catalog.cmdAttached(containerId, `ls -lb ${folder}`, matchPattern) 
      } 
    }
  })

  vorpal.command('go', `Execute the Batch on the Target SQL Server using mssql.Request.query()`)
  .option('-p, --pool', `Choose any Connection Pool now in the Catalog`)
  .action( async args => {
    // try {
      let result
      let query = api.compile(api.batch)
      let containerId = (!args || !args.options.pool)? catalog.sql.Instance: await catalog.choosePoolId() 
      if (catalog.sql.Pools.has(containerId)) {    
        result = await go(query.trim(), containerId)
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
    // }
    // catch (err) {
    //   log('error', `(vorpal.go-try) error`)
    // }
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
      Use {bold Ctrl}{bold -C} to abort a too-long running CLI command.`)
      let collection = await api.choose(Object.keys(store), 'Collection')
      let find
      do {
        find = await api.input(`find - JSON:`, JSON.stringify({}))
      }
      while (!isJSON(find)) 
      let projection
      do {
        projection = await api.input('projection - JSON:', JSON.stringify({}))
      }
      while (!isJSON(projection)) 
      let sort
      do {
        sort = await api.input('sort - JSON', JSON.stringify({createdAt: -1}))
      }
      while (!isJSON(sort)) 
      let limit = await api.input('limit - integer', '8')
      let skip = await api.input('skip - integer', '0')
      log('log', await store.search(collection, JSON.parse(find), JSON.parse(projection), JSON.parse(sort), limit, skip))
    }
    catch(err) {
      log('error', err)
    }
  })

vorpal.command(`image [action]`, chalk`Local Microsoft SQL Server Images pulled from hub.docker.com\n
  Actions:\n
                  (${view.dft()}) View the Full Catalog Object of the Target instance    
    {bold all}       All local Images
    {bold available} Images available (opens in browser)
    {bold delete}    Remove an image with no
    {bold full}      Full definition of the Catalog Object for a selected Image
    {bold pull}      Pull latest image from docker hub when newer
    {bold run}       Create and start new Container using current config.json settings and a selected Image\n
  This command is ALT key aware. Pressing '{bold ALT+i}' on a new line autofills the command's name\n`) 
  .autocomplete(['all', 'available', 'delete', 'full', 'pull', 'run'])
  .action( async args => {
    if (await catalog.isHost()) {
      switch (args.action) {
      case ('all'):
        log('log', catalog.listImages())
        break
      case ('available'):
        await api.spawnTask(`${config.browser.command} ${config.mssql.repo.availableTags}`)
        break
      case ('delete'):       
        await catalog.removeImage()
        break  
      case ('pull'):
        await catalog.pullImage()
        break
      case ('run'):
        await catalog.runImage()
        break
      case ('full'):
        log('log', await catalog.getImage(await catalog.chooseImageId()))
        break
      default:
        log('log', await catalog.getImage(catalog.sql.ContainerInfos.get(catalog.sql.Instance).ImageID))
        break
      }
    }
  })

vorpal.command(`log [source]`, chalk`Container Logs\n
  Use the {italic xp_readerrorlog} SQL Server extended stored procedure to read SQL Log files 
  stored in the container else read slightly more info but with fewer filtering option than the 
  extended proc from the Container's log via the Docker 
  API. The\n 
  Sources:
    {bold docker}  Use the Docker Container's log (includes errorlogs)      
      docker.tail.settings are passed to docker whenever reading logs: 
  ${format(config.docker.tail.settings)}\n
    {bold.bgMagenta sql}  (${view.dft()}) Use {bold xp_readerrorlog} output
    extended stored procedure params must be passsed to SQL Server by position as:
    {underline option}  {underline position}  {underline command option}  {underline ${view.dft()} value             }_
      1          3         find1           nothing (empty string)
      2          4         find2           nothing (empty string)
      3          2         agent           use SQL Server errorlog
      4          5         since           nothing (empty string)
      5          6         until           nothing (empty string)
      6          7         descending      ascending sort by datestamp
      7          1         extention       0 \n`)
  .autocomplete(['docker', 'sql']) 
  .option(`-1, --find1 [find-string]`, chalk`Optional String to match exactly`)
  .option(`-2, --find2 [find-string]`, chalk`Optional second String to match exactly`)
  .option(`-3, --agent`, chalk`Output SQL Agent Logs {italic instead of} SQL Server Logs {yellowBright sql source only}`)
  .option(`-4, --since [first-date-time]`, chalk`Date.parce(able) UTC datetime string of oldest row to show (${view.dft()} is container's StartedAt)`)
  .option(`-5, --until [last-date-time]`, chalk`Date.parce(able) UTC datetime string of newest row to show (e.g., "2020-01-04T15:42:52Z")`)
  .option(`-6, --descending`, chalk`Reverse the order of log rows by date {yellowBright sql source only}`)
  .option(`-7, --extention [logfile-number]`, chalk`Optional log file archive extension {yellowBright sql source only}`)
  .option(`-f, --follow [true-false]`, chalk`Watch for and output new log rows as written {greenBright docker source only}`)
  .option(`-t, --tail ["all"-or-number]`, chalk`Number of matched rows from end of log to output {greenBright docker source only}`)
  .action( 
    async args => {
      if (await catalog.isHost()) {
        let containerId
        let source = args.source||'sql'
        switch (source) {
          case ('docker') :
            if (args.options.extention) log('warn', chalk`Ignoring {bold --extention}`)      
            if (args.options.agent) log('warn', chalk`Ignoring {bold --agent}`)      
            if (args.options.descending) log('warn', chalk`Ignoring {bold --descending}`)      
            let logConfig = config.docker.tail.settings
            containerId = await catalog.chooseInstanceId('up') 
            let state = (await catalog.inspectContainer(containerId)).State
            if (args.options.tail) logConfig.tail= args.options.tail? args.options.tail: "all"
            logConfig.since=(new Date(args.options.since? args.options.since: state.StartedAt)).toISOString()
            if (args.options.until) logConfig.until=new Date(args.options.until) 
            await catalog.tailLog(containerId, `data`, logConfig)  
            break
          case ('sql') :
            if (args.options.follow) log('warn', chalk`Ignoring {bold --follow}`)      
            if (args.options.tail) log('warn', chalk`Ignoring {bold --tail}`)      
            containerId = await catalog.choosePoolId()    
            await readLog(containerId, args.options)
            break
          default :
            log('warn', chalk`unrecognized source: ${args.source}`)
          break  
      }
    }
  })

vorpal.command(`query [action] [filter]`, chalk`CLI query store\n
  Personal, Private, Persistent, NEDB document database store of reusable TSQL queries
  Good practice to {bold archive} the store prior to any {bold edit}, {bold import} or {bold put} actions 
  Also wise to {bold commit} all changes in '/lib/queries.js' to the local repo before a {bold sync}   
  Actions:\n
    {bold archive}        Archive all queries from the store into a user specified file (other than queries.js) 
    {bold develop}        Open './lib/queries.js' for edit in the configured IDE ({italic config.ide}: ${config.ide}) 
    {bold edit}           Edit the persistent stored query (for one-off changes, load ({bold.inverse query [load]}) then edit the batch ({bold.inverse batch edit}) )
    {bold get}            Display a query from the store (not loaded, simply output to screen for viewing)
    {bold import}         Load all queries from './lib/queries.js' into the CLI query store ({bold opposite of sync})
    {bold.bgMagenta load} (${view.dft()}) Load a query from the nedb to the Batch cache for submission        
    {bold put}            Add the query now in the Batch cache into the CLI's query store
    {bold sync}\n         Overwrite './lib/queries.js' with all CLI queries now in nedb store (opposite of {bold import})   
  Filter:\n
    name match string\n`)
  .autocomplete(['archive', 'delete', 'develop', 'edit', 'get', 'import', 'load', 'put', 'sync'])
  .action( async args => {
    let queryName, suggestedName
    let available = await templates.names(args.filter)
    if (!available || available.length===0) {
      templates.import()
    }
    switch(args.action) {
      case ('archive'):
        suggestedName = path.resolve(config.cli.scripts.path, `query_store_archive_${(new Date()).toISOString()}`)
        await api.archiveQueries(await api.input('Target file for queries collection archive', suggestedName))
        break
      case ('delete'):
        queryName = await api.choose(await templates.names(args.filter), 'Query to delete')
        templates.remove(queryName)
        break
      case ('develop'):
         api.spawnTask(`${config.ide} ${path.resolve(`./lib/queries.js`)}`) 
         break
      case ('edit'):
        queryName = await api.choose(await templates.names(args.filter), 'Query to edit')      
        templates.upsert(queryName, await api.editText(await templates.get(queryName)))
        break
      case ('get'): // can use to refer back to existing while composing - does not touch Batch
        queryName = await api.choose(await templates.names(args.filter), 'query to show')
        log('log', await templates.get(queryName))
        break
      case ('import'):
        templates.import()
        log('log', 'query store is now overwritten with definitions from queries.js')
        break
      case ('put'):
        templates.put(await api.input('Name for Query in Store'), api.compile())
        break
      case ('sync'):
        await api.archiveQueries(path.resolve('lib/queries.js'))
        log('log', 'query store has overwritten queries.js')
        break
      case ('load'): 
      default:
        queryName = await api.choose(await templates.names(args.filter), 'query to load into the Batch', suggestedName)
        api.batch = (!queryName)? '': (await templates.get(queryName)).split('\n')
        break
    }
  })

vorpal.command(`repo [action]`, chalk`Source control using simple-git API\n
  Actions:  
    {bold add}            Stage file system changes into local repo
    {bold commit}         Accept staged changes
    {bold fetch}          Bring all changes at remote to local repo
    {bold init}           Initialize the local repo
    {bold merge}          Merge remote and local repo
    {bold reset}          Un-stage all staged files
    {bold remote}         URL with authentication for remote
    {bold push}           Move all committed changes from local into remote
    {bold status}         Display object showing all changes to local repo
    `
)
.autocomplete(Object.keys(repo))
.action( async (args) => {
  let choice
  if (args.action && !['remoteURL', 'status'].includes(args.action)) {
    log('log', `Local repo state before ${args.action}:\n${format(await repo.status())}`)
  }  
  switch (args.action) {
    case ('add'):
      await repo.add()
      break
    case ('commit'):
      await repo.commit()
      break
    case ('fetch'):
      await repo.fetch()
      break
    case ('init'):
      await repo.init()
      break
    case ('merge'):
      await repo.merge()
      break
    case ('push'):
      await repo.push()
      break
    case ('reset'):
      await repo.reset()
      break
    case ('remoteURL'):
      log('log', await repo.remoteURL())
      break
    case ('status'):
    default:
      log('log', `Current state of local repo:\n${format(await repo.status())}`)
      break
  }
})

vorpal.command(`run`, `Execute the Batch on the Target using mssql.Request.batch()`)
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

vorpal.command(`script [action] [filter]`, chalk`File System stored T-SQL scripts\n 
  Uses files from the configured scripts folder: {italic config.cli.scripts.path} 
    currently: '${config.cli.scripts.path}'\n
  Actions:\n
    {bold archive}        Save a copy of all scripts in the scripts folder to nedb scripts store
    {bold backup}         Save a copy of a selected script to the nedb scripts store
    {bold browse}         Open a selected script in the browser
    {bold develop}        Open a selected script in the configured IDE: '${config.ide}'
    {bold edit}           Open a selected script in the configured editor: '${config.editor}'
    {bold get}            Display a script from the 'scripts' folder (not loaded to cache, output to screen only)
    {dim.bgMagenta load} (${view.dft()}) Load a script from the 'scripts' folder to the Batch cache   
    {bold new}            Create a new script  
    {bold restore}        Display a script from the 'scripts' nedb archive (not loaded to cache, output to screen only)
    {bold save}           Save the current batch cache to a script file\n
  Filter: any valid String.match`)
  .autocomplete(['archive', 'backup', 'browse', 'develop', 'edit', 'get', 'load', 'new', 'restore', 'save'])
  .action( async args => {
    let scriptName
    let text
    let available = await api.listFiles(path.resolve(config.cli.scripts.path), config.cli.scripts.filter)
    // for (let name of available) {
    //   if (!args.filter || name.startsWith(args.filter)) {
    //     available.push(name.replace(config.cli.scripts.filter, ``))
    //   }
    // }  
    switch (args.action) {
      case ('archive'):
        for (let name of available) {
          text = await api.fileToJSON(path.resolve(config.cli.scripts.path, name + config.cli.scripts.filter))
          scripts.put(name, text)
        }  
        break
      case ('backup'): 
        scriptName = await api.choose(available, 'Script to save (upsert) into archive')
        scripts.upsert(scriptName, await fileToJSON(path.resolve(config.cli.scripts.path, scriptName, config.cli.scripts.filter)))
        break
      case ('browse'): 
        scriptName = await api.choose(available, 'Script to open in browser')
        doc = await view.highlightSource(path.resolve(config.cli.scripts.path, scriptName.concat('.sql'))) 
        await api.spawnTask(`${config.browser.command} ${doc}`)
        break
      case ('develop'):
        if (config.ide) {
          scriptName = await api.choose(available, `Script to develop (opens in '${config.ide}')`)
          await api.spawnTask(`${config.ide} ${path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter)}`)
        } else log('warn', 'no IDE configured')
        break
      case ('edit'):
        scriptName = await api.choose(available, `Script to edit (opens in '${config.editor}'`)
        await api.editFile(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter))
        break
      case ('get'):
        scriptName = await api.choose(available, 'Script to display (does not touch Batch)')
        log('log', await api.fileToJSON(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter)))
        break
      case ('new'):
        if (config.ide) {
          scriptName = await api.input(`New script name (opens in '${config.ide}')`)
          await api.spawnTask(`${config.ide} ${path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter)}`)
        } else log('warn', 'no IDE configured')
        break
      case ('restore'):
        scriptName = await api.choose(await scripts.listNames(), 'Select script to display without spoiling the Batch')
        break
      case ('save'):
        log('log', await api.jsonToFIle(path.resolve(config.cli.scripts.path, scriptName + config.cli.scripts.filter)))
        break
      case ('load'):
      default:
        scriptName = await api.choose(available, 'Select script to load to Batch cache')
        await api.fileToBatch(path.resolve(config.cli.scripts.path, scriptName))
        break
    }
  })

vorpal.command(`settings [purpose]`, chalk`Configurable Settings\n
  Purposes:\n
                    (${view.dft()}) Review the {italic buffered} config object 
    {bold config}          Open './config/config.json' file with '${config.editor}'        
    {bold sqlpad}          Work with the ENVIRONMENT variables in the SQLPad Container 
    {bold sqlserver}       Work with the ENVIRONMENT variables in a SQL Container 
    {bold git      }       Open './.gitignore' with '${config.editor}'`)  
  .autocomplete([`config`, `environment`, `mssqlconf`, `sqlpad`])
  .action( async args => {
    let containerId
    switch(args.purpose) {
      
      // try to open the config file in the configured IDE. 
      // If the IDE is not present locally or not configured, 
      // try to open in configured editor. 
      // If the editor is not present, use vi.
      
      case ('config'):
        try {

          await api.editFile(`config/config.json`)
        }
        catch(error) {
          try {

          }
          catch(er) {

          }
        }
        break
      case ('gitignore'):
        await api.editFile(`.gitignore`)
        break
      case ('sqlpad'):
        let containers = []
        for (let [imageId, image] of (await api.sqlpadImages())) {
          containers.concat(await api.sqlpadContainers(imageId))
        } 
        containerId = await api.choose(containers, 'SQLPad container', containers.pop()) 
        await api.interactiveShell(containerId, 'SET')
        break  
      case ('sqlserver'):
        containerId = await catalog.chooseInstanceId('up')
        await api.interactiveShell(containerId, 'SET')
        break
      default:
        log('log', config)
        break
    }
  })

vorpal.command(`sqlcmd [action]`, chalk`Execute the Batch or a TSQL script via SQLCMD (ODBC) 
  Uses the 'mssql-tools' included with the SQL Server inside an 'official' SQL Container\n
  Actions:\n
    {bold exec}         Submit the query now in the Batch cache
    {bold flags}        SQLCMD's default command-line switches
    {bold input}        Select a query or script input file 
    {bold session}      Submit the query now in the Batch cache and remain in the SQLCMD session
    {bold spexec}       Submit the query now in the Batch cache wrapped in sp_executesql() 
    {bold.bgMagenta usage}      (${view.dft()}) echo the sqlcmd command-line usage message\n`)
  .autocomplete(['exec', 'flags', 'input', 'session', 'spexec', 'usage'])
  .option('-o, --output', 'Save output to a file in staging')
  .action( async args => {
    if (await catalog.isHost()) {
      let containerId = await catalog.chooseInstanceId('up')
      if (containerId) {
        let cmdArgs = [] // populated from config.sqlcmd
        let sqlArg = ''  
        let tsql = `"${api.compile(config.sqlcmd.prebatch)}\nGO\n${api.compile(config.sqlcmd.prefix)}\n${api.compile()}"`
        switch(args.action) {
        case ('spexec'): 
          sqlArg=`-Q` 
          tsql= `${api.compile(config.sqlcmd.prebatch)}\nGO\n"${api.compile(config.sqlcmd.prefix)} exec sp_executesq('${api.compile()}')"`
          break
        case ('input'):
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
          await catalog.cmdAttached(containerId, `${path.resolve(config.cli.odbc.path, 'sqlcmd -?')}`)
          break
        }
        if (sqlArg) {
          let cfgUser = config.sqlcmd.switch.U
          config.sqlcmd.switch.U = await api.input(chalk`{bold SQL Server} user name`, config.sqlcmd.switch.U)
          if (config.sqlcmd.switch.U!==cfgUser || !config.sqlcmd.switch.P) {
            config.sqlcmd.switch.P = await api.secret(chalk`{bold SQL Server} user password`)
          } 
          config.sqlcmd.switch.d = config.mssql.pool.database
          Object.keys(config.sqlcmd.switch).forEach( key => {
            cmdArgs.push(`-${key}`)
            if (config.sqlcmd.switch[key]!==key) {
              cmdArgs.push(config.sqlcmd.switch[key])
            }
          })
          let result = await catalog.cmdAttached(containerId, `sqlcmd ${cmdArgs.join(' ')} ${sqlArg}`.concat(tsql))
          api.batch.splice(0)
          if (args.options.output) {
            let suggestedName = path.resolve(config.cli.scripts.path, `outfile_${(new Date()).toISOString()}`)            
            writeResults(await api.input('Host file where output is to be stored', suggestedName), result) 
          }
        }
      }
    }
  })

// TODO need a data store transfer for moving query and report def stores between containers  
vorpal.command(`sqlpad [action]`, chalk`Open Source SQL editor and report server for the V8 browser\n 
  Review the source - and read descriptions of all of the SQLPad container environment variables in
  SQLPad author Rick Bergfalk's SQLPad Github repo, https://github.com/rickbergfalk/sqlpad.
  SQLPad stores TSQL queries, tedious.js database connections and chart definitions for recall on 
  demand, and renders tabular or json query results as well as graphical data reports from any 
  browser built with the V8 Javascript Engine. SQLPad helps out during query composition with 
  SQL autocomplete functionality.\n 
  Modify a SQLPad container's environment variables with {bold.inverse settings sqlpad}
    -or-
  Edit the default environment variables*, e.g., set SQLPad to start with CLI start, or enable 
  TLS for the ${view.name()}'s SQLPad web server in file './config/config.json' ({bold.inverse settings config}).\n
  Note that SQLPad provides unix ODBC support that is unused by the ${view.name()}. Several databases other 
  than Microsoft SQL Server can be queried through this unix ODBC protocol.\n 
  Actions:\n
    {bold bash}       Open a bash command prompt in a SQLPad container  
    {bold containers} Current local SQLPad container inventory       
    {bold images}     Current local SQLPad image inventory
    {bold map}        Catalog of local SQLPad Docker artifacts           
    {bold pull}       Fetch the latest SQLPad hub.docker.com image (if newer) 
    {bold rm}         Remove one or more SQLPad container from local inventory       
    {bold rmi}        Remove one or more SQLPad image from local inventory       
    {bold run}        Launch a new SQLPad container from a selected image
    {bold start}      Start SQLPad container
    {dim.bgMagenta status}      (${view.dft()}) State of a SQLPad Container
    {bold stop}       Stop SQLPad container
    {bold target}     Current active SQLPad container\n`)
  .autocomplete([ 'configure', 'container', 'image', 'map', 'pull', 'run', 'start', 'status', 'stop'])
  .action( async (args, cb) => {
    let containers = [], images = [], containerId, imageId
    switch (args.action) {
      case ('bash'):
        for (let [imageId, image] of (await api.sqlpadImages())) {
          containers.concat(await api.sqlpadContainers(imageId))
        } 
        containerId = await api.choose(containers, 'SQLPad container', containers.pop()) 
        await api.interactiveShell(containerId)
        break  
      case ('containers'):
        log('log', sqlpadMap.containers.keys())
        break
      case ('images'):
        log('log', sqlpadMap.images.keys())
        break 
      case ('map'):
        await sqlpad.map()
        log('sqlpad', sqlpad.sqlpadMap)
        break 
      case ('rm'): 
        // choose from idle containers
        await sqlpad.drop()
        break
      case ('rmi'): 
        // choose from unused images
        await sqlpad.remove()
        break
      case ('run'): 
        imageId = await api.choose(Array.from(sqlpad.sqlpadMap.images.keys()), 
            'Create SQLPad container from image', 
            images[images.length-1])
        await sqlpad.runImage(imageId)
        break
      case ('start'):
        await sqlpad.start()
        break
      case ('stop'):
        await sqlpad.stop()
        break
      case ('status'):  
      default:
        if (!sqlpad.sqlpad) {
          log('log', chalk`SQLPad web server not attached, try {bold sqlpad start}`)
        } else {
          await sqlpad.status()
          log('log', `SQLPad Server is Running  
            PID: ${sqlpad.sqlpad.pid}
            URI: ${config.sqlpad.protocol}://${sqlpad.ip}:${sqlpad["https-port"]}`)
        }
        break
    }
  })

  vorpal.command('stream', `Execute the Batch using mssql.Request.batch() and stream results back`)
  .action( async () => {
    // try {
      let result
      let query = api.compile(api.batch)
      if (catalog.sql.Pools.has(catalog.sql.Instance)) {
        await stream(query.trim(), catalog.sql.Instance)
        api.batch.splice(0)
      } 
    // }
    // catch (err) {
    //   log('error', err)
    // }
  })

// extension added only when 'test' literal passed as arg at start: 'node server.js test' or 'npm start test'
if (process.argv.length===3 && process.argv[2]==='test') {
  const tests = require(`../tests/${process.argv[2]}`)
  vorpal.use(tests)
} 

vorpal.command(`tls [socket-name]`, chalk`TLS Credentials\n
  Generate TLS credentials and store as .pem files in the ${view.name()}'s '/private' subfolder.
  New credentials immediately overwrite those in use by the CLI or SQLPad socket. A restart of the
  socket is necessary for resolution. {yellowBright No restarts are conducted by this command.}   
  Sockets:\n 
              (${view.dft()}) The existing collection of {bold ${view.name()}} TLS certificates 
    {bold docker}    Generate a certificate for the Docker daemon API
    {bold sqlpad}    Generate a certificate for the SQLPad Web Server
    {bold sqlserver} Generate a certificate for SQL Server Query Engine Connections\n`)
  .autocomplete(['docker', 'sqlpad', 'sqlserver'])
  .option('-c, --clientAuth', chalk`Use for CLI TLS Client Authentication (${view.dft()} is 'serverAuth') `)
  .option(`-h, --hotelJuliet`, chalk`Remove and regenerate all credentials, including the 'ca'`)
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
      log('log', (await api.listFiles('private', args["socket-name"] || '.pem')).join('\n'))
      await api.mssqlConf(catalog.sql.Instance, '-h')
    }
  })

vorpal.command(`use [database]`, 
  `CLI Database Context - change Target's Connection Pool database
  Changes the database attribute for the CLI's current Connection Pool. The change is pesistent.`)
  .action( async args => {
    if (!args.database) {
      log('log', `database: ${(await pools.get(catalog.sql.Instance)).pool.database}`)
    } else {
      if (catalog.sql.Pools.has(catalog.sql.Instance)) {
        await catalog.openInstance(catalog.sql.Instance, args.database)
      }  
    }
  })
  
vorpal.catch('[tsql...]', view.descr) 
  .help(async () => {
    log('log', await view.quickstart('cli'));
  })
  .allowUnknownOptions() // let any '-' or '--' args pass through (gulp)
  .action( async () => {
    try {
      let txt = (await lines.getLast()).line
      if (isBash) { // ALT+b   
        let target = await api.choose(catalog.listInstanceIds('up').concat('host'), 
          'target of shell command', 
          'host')
        if (target==='host') log('log', await api.shell(txt))
        else log('log', await catalog.cmdAttached(target, txt))
      } else api.batch.push(txt)
    }
    catch (err) { log('error', `(vorpal.catch-try) err\n${format(err)}`)}
    isBash=false 
  })

