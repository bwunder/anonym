//// NPM
//// CORE
//// LOCAL
const { attachDocker, shell } = require('../lib/api')
const { sql } = require('../lib/catalog') 
const cli = require('../lib/cli')
const { format, log } = require('../lib/log')
const { commit, fetch, git, push, status } = require('../lib/repo')
const { sqlpad, map } = require('../lib/sqlpad')
const { compactAll, errors, lines, words } = require('../lib/store')

const config = require('../config/config.json')

process.on('unhandledRejection', err => {
  err.source = `process_unhandledRejection`
  errors.put(err)
  log('error', `(anonym.js) ${format(err)}`)
})

process.on('error', err => {
  err.source = `process_error`
  errors.put(err)
  log('error', `(anonym.js) ${format(err)}`)
})

process.on('exit', async code => {
  try {
    if (sql.Pools && sql.Pools.size > 0) {
      for (let pool in sql.Pools) {
        log('confirm', `(anonym.js.process_exit) Closing connection pool ${pool[0]}...\n`)
        pool[1].close()
      }
    }
    // log every cli stutdown
    if (!(await lines.getLast()).line==='exit') lines.put('exit')
    // archive tracked changes
    log('log', `git status ${format(await git.status())}`)
    return status()
    .then( (result) => {
      return commit()
    })
    .then( () => {
      // nedb maintenance
      return compactAll()
    })
    .then(() => {
      log('exit', `exit code: ${code}\n`)
      if (sqlpad) sqlpad.kill(1)
    })
    .catch( err => log('error', `(anonym.js) exit failed\n${format(error)}`))  
  }
  catch(err) {
    log('error', `(anonym.js) error on exit\n${format(err)}\n`)
  }
})

// log app startup commandline
lines.put(process.argv)
return git.checkIsRepo()
.then( async (isRepo) => {
  if (!isRepo) {
    throw(new Error(`Local git repository found in ${process.cwd()}`))
  }   
  return attachDocker()
})
.then( async () => { 
  if (config.sqlpad.runAtStartup) { 
    await map()
  }   
  cli.show()
  return git.status()
})
.then( async (changes) => { 
  for (const key of Object.keys(changes)) {
    if (Array.isArray(changes[key]) && changes[key].length>0) {
      await commit()
      break
    }
  }
  return git.status()
})
.then( async (changes) => { 
  if (changes.ahead>0) { 
    return push()
  } else if (changes.behind>0) { 
    return fetch()  
  }  
})
.catch( err => {
  if (err.fileName) {
    log('error', `(anonym.js) module: ${err.fileName} line: ${err.lineNumber} \n${format(err)}\n`)
  } else {
    log('error', `(anonym.js) error at start-up\n${format(err)}\n`)
  }
})

