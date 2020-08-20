// replaces anonym.js and cli.js - each command get a new file in /commands
//// NPM
const chalk = require('chalk')
const inquirer = require('inquirer')
// with a command prompt that extends the inquirer input prompt to a command prompt
// mark my words, I will regret using the extension once it falls into disuse
// this happened with vorpal
inquirer.registerPrompt('command', require('inquirer-command-prompt'))
//// CORE
const path = require('path')
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

const batch = []
var isBash = false
var line = ''
var commands 

// command modules
//const about = require('../lib/commands/about')
function setCommands()  {
  return api.listFiles('../anonym/lib/commands/', '.js')
  .then((files) => {
    const cmds = {}
    let cmd
    for (let fname of files) {
      cmd = fname.replace('.js', '')
      if (cmd==='test') {
        // extension - added only when 'test' literal passed at start
        // as in: 'node lib/anonym.js test' or 'npm start test'
        if (!process.argv.includes('test')) {
          continue
        }        
      }
      try {
        cmds[cmd] = require(`../lib/commands/${cmd}`)
      }
      catch (err) {
        log('error', `(anonym.js) setCommands ${cmd} import error\n${format(err)}`)
      }
    }  
    return cmds
  })
  .catch(err => {
    log('error', `(anonym.js) setCommands ${cmd} Promise error\n${format(err)}`)
  })
}  

async function runPrompt(msg='') {

  const availableCommands = [
    {
      filter: function (str) {
        return str.replace(/ \[.*$/, '')
      }
    },
    'exit'
  ]
  for (let cmd of Object.keys(commands)) {
    availableCommands.push(cmd)
  } 
  return inquirer.prompt([
    {
      type: 'command',
      name: view.delimiter,
      autoCompletion: availableCommands,
      message: msg,
      prefix: '', 
      short: true
    }
  ]).then(async answers => {
    if (availableCommands.includes(answers.cmd)) {
      let args = {}
      // prompt for args then cmd.dispatch(arg,arg,...) the request
      for (let arg of Object.keys(commands[answers.cmd].args)) {
        let choices = Object.keys(commands[answers.cmd].args[arg])
        let msg = `value for ${answers.cmd} arg ${arg}`
        if (choices.length>2) {
          // if is a default in choices make it the default here
          dft = commands[answers.cmd].args[arg].find(view.dft())
          args[answers.cmd]=api.choose(Object.keys(commands[answers.cmd].args), `Select ${msg}`, dft)
        }  
        else {
          args[answers.cmd]=api.input(`Enter ${msg}`, args[arg], choices.length===1? args[arg]: '')
        }  
      }  
    } else {
      api.batch.push(line) 
      line=''
    }
    //runPrompt()
  }).catch(err => {
    log('error', `(anonym.js) runPrompt error\n${err.stack}`)
    process.exit(-1)
  })
}

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
    if (config.git.commitAtExit) {
      await repo.add()
      await repo.commit() // commit any changes (w/opt out)
    }  
    log('exit', `exit code: ${code}\n`)
  }
  catch(err) {
    log('error', `(anonym.js) error on exit\n${format(err)}\n`)
  }
})

process.stdin.on('keypress', (str, key) => {
  // ui.updateBottomBar(chalk`(keypress event) 
  //   str: {inverse ${str}] len: ${!str? 0: str.length} cp: ${str.codePointAt(0)} 
  //   key: {inverse ${format(key, 7)}}
  //   batch: {inverse ${api.batch.join().length>0?api.compile():'no cached query text'}}
  //   line: {inverse ${line}}\n`)
  switch (true) {
    case (key.ctrl):
      switch (key.name) {
        case ('b'): // 
          log('log', `batch cache\n${api.batch.join().length>0?api.compile():'no cached query text'}`)
          break 
        case ('c'):
          process.exit(0)
          break 
        default:
          log('warn', `ignoring '${format(key)}'`)
          break
      }      
      break
    case (key.meta): // ALT+
      switch (key.name) {
        case (`s`): //(ALT+s) run one-off shell cmd in container
          return api.choose(catalog.listInstanceIds('up').concat('host'), 'target of one-off shell command', 'host')
          .then( async target => {
            const cmd = await api.input(`Shell command line to be run on '${target}'`) 
            if (target==='host') log('log', await api.shell(cmd))
            else log('log', await catalog.cmdAttached(target, cmd))        
          })
          .catch( err => log('error', `shell call failed\n${err}`))
          break
        default:
          log('warn', `ignoring 'ALT+${str||key.name}'`)
          break
      }
      break  
    case (key.name==='return'): 
      if (line) store.lines.put(line)
      api.batch.push(line)
      isBash=false 
      line = ''
      break
    case (key.shift): 
    default:
      line+=str
      break
  } 
})

return repo.add()                      //  repo add any changes (w/opt out)
.then( async () => {
  try {
    await store.words.setKeys()        // gen master pass and salt
    store.lines.put(process.argv)      // log the command line
    if (config.git.commitAtStartUp) await repo.commit() // commit any changes (w/opt out)
    if (config.sqlpad.runAtStartup) await sqlpad.map()  // launch SQLPad
    await api.attachDocker()           // prepare for container IPCs
    commands = await setCommands()
    // log('info', chalk.underline`commands`)
    // for (const command of Object.keys(commands)) { 
    //    log('log', chalk`\t{cyanBright ${command}}`)
    //   log('log', chalk`\t{cyanBright ${command.padEnd(12)}} - ${commands[command].description.split('\n')[0]}`)
    //   log('info', `${command}: ${format(commands[command])}`)
    // }  
    await runPrompt()  
  }
  catch(err) {
    if (err.fileName) {
      log('error', `(anonym.js) module: ${err.fileName} line: ${err.lineNumber} \n${format(err)}\n`)
    } else {
      log('error', `(anonym.js) error at start-up\n${format(err)}\n`)
    }
  }
})
