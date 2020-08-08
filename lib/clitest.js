//// NPM
//// CORE
const readline = require('readline')
const repl = require('repl')
//// LOCAL
const api = require('../lib/api')
const catalog = require('../lib/catalog')
const { format, log } = require('../lib/log')
const repo = require('../lib/repo')
const sqlpad = require('../lib/sqlpad')
const store = require('../lib/store')
const view = require('../lib/viewer')

const config = require('../config/config.json')

// this module will be a merge of anonym.js & the line reader portion of cli.js
// individual commands are each in own module in '/commands/' and are
// described and invoked as this readline interface  

// from original anonym.js
//// NPM
//// CORE
//// LOCAL
    // ******** using constructed obj const { attachDocker } = require('../lib/api')
    // ******** using constructed obj const { sql } = require('../lib/catalog') 
//const cli = require('../lib/cli') // need the constructed vorpal object we want to eliminate
    // already const { format, log } = require('../lib/log')
//const { add, commit } = require('../lib/repo') cli uses constructed 
    // already const { sqlpad, map } = require('../lib/sqlpad') cli uses constructed
    // ******* using constructed obj const { compactAll, errors, lines, words } = require('../lib/store')

    const batch = []
    var isBash = false
    var line = '' 
    
    readline.emitKeypressEvents(process.stdin)
    const rl = readline.createInterface({
      completer: undefined, // An optional function used for Tab autocompletion. !!!see how vorpal does it!!!
      input: process.stdin,
      output: process.stdout,
      prompt: view.delimiter,
      removeHistoryDuplicates: true,
      tabsize: 2 // ???? it is not doing this ????
    })
    if (process.stdin.isTTY) process.stdin.setRawMode(true)
    
    process.on('unhandledRejection', err => {
      err.source = `process_unhandledRejection`
      store.errors.put(err)
      log('error', `(anonym.js) process unhandled rejection event\n${format(err)}`)
    })
    
    process.on('error', err => {
      err.source = `process_error`
      store.errors.put(err)
      log('error', `(anonym.js) process error event\n${format(err)}`)
    })
    
    process.on('exit', async code => {
      try {
        if (catalog.sql.Pools && catalog.sql.Pools.size > 0) {
          for (let pool in catalog.sql.Pools) {
            log('confirm', `(anonym.js.process_exit) Closing connection pool ${pool[0]}...\n`)
            pool[1].close()
          }
        }
        if (sqlpad) sqlpad.kill(1)
        log('exit', `exit code: ${code}\n`)
      }
      catch(err) {
        log('error', `(anonym.js) error on exit\n${format(err)}\n`)
      }
    })
    
    return repo.add()
    .then( async () => {
      try {
        store.lines.put(process.argv)                    // log startup commandline
        await store.words.setKeys()
        await repo.commit()                              // opt in/out of add and/or commit of any changes
        if (config.sqlpad.runAtStartup) await map()      // launch UI Express server if
        await api.attachDocker()                         // prepare for container IPC   
        rl.prompt()                                      // open CLI prompt
      }
      catch(err) {
        if (err.fileName) {
          log('error', `(anonym.js) module: ${err.fileName} line: ${err.lineNumber} \n${format(err)}\n`)
        } else {
          log('error', `(anonym.js) error at start-up\n${format(err)}\n`)
        }
      }
    })
    
// from original cli.js
//// NPM
//const vorpal = require('vorpal')() lodash is out of date and I have no business trying to fix npm'ed pkg
//// core
//const path = require('path')
//// local
    // already const api = require('../lib/api')
    // already const catalog = require('../lib/catalog')  
    // already const { format, log } = require('../lib/log')
//const repo = require('../lib/repo') 
//const { run, isSQL, go, readLog, stream } = require('../lib/sqldb')
    // already const sqlpad = require('../lib/sqlpad')
    // already const store = require('../lib/store')
//const { genCertificate, hotelJuliet} = require('../lib/tls')
    // already const view = require('../lib/viewer')

process.stdin.on('keypress', (str, key) => {
  log('info', `(keypress event callback) str: '${str}' len: ${!str? 0: str.length} cp: ${str.codePointAt(0)} 
    key: ${format(key, 7)}
    batch: ${api.batch.join().length>0?api.compile():'no cached query text'}
    line: ${line}`
  )
  switch (true) {
    case (key.ctrl):
      switch (key.name) {
        case ('b'):
          log('log', `batch cache
            ${api.batch.join().length>0?api.compile():'no cached query text'}`)
          break 
        case ('c'):
          process.exit(0)
          break 
        default:
          console.log(`ignoring 'CTRL+${str||key.name}'`)
          break
      }      
      rl.prompt()
      break
    case (key.meta): // ALT+
      switch (key.name) {
        case (`s`):
          return api.choose(catalog.listInstanceIds('up').concat('host'), 'target of one-off shell command', 'host')
          .then( async target => {
            const cmd = await api.input(`Type shell command to be run on '${target}'`) 
            if (target==='host') log('log', await api.shell(cmd))
            else log('log', await catalog.cmdAttached(target, cmd))        
          })
          .catch( err => log('error', `shell call failed\n${err}`))
          break
        default:
          log('log', `ignoring 'ALT+${str||key.name}'`)
          break
      }
      rl.prompt()
      break  
    case (key.name==='return'): 
      // gnome terminal 3.36.1.1 enter key src='\r' [codepoint 13], key.name==='return'
      // ???suspect this could change in others distros??? 
      if (line) store.lines.put(line)
      api.batch.push(line)
      isBash=false 
      line = ''
      rl.prompt()
      break
    case (key.name = 'tab' && line==='\t'):
      // top level autocomplete - array of commands
      const commands = ['about', 'batch', 'catalog', 'connection', 'container', 'engine', 
      'exit', 'files', 'go', 'help', 'history', 'image', 'log',  'query', 'quit', 'repo',
      'run', 'script', 'settings', 'sqlcmd', 'sqlpad', 'stream', 'tls', 'use']
      log('log', commands.join('\n'))
      rl.prompt()
      break  
    case (key.shift): 
    default:
      line+=str
      break
  }  
})

