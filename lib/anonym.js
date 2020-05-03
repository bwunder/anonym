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
    .catch( err => log('error', `(anonym.js) error at exit\n${format(error)}`))  
  }
  catch(err) {
    log('error', `(anonym.js) exet event error\n${format(err)}\n`)
  }
})

// log app startup commandline
lines.put(process.argv)
return git.checkIsRepo()
.then( async (isRepo) => {
  if (isRepo) {
    await attachDocker()
    if (config.sqlpad.runAtStartup) await map()
    cli.show()
    let changes = await git.status()
    for (const key of Object.keys(changes)) {
      if (Array.isArray(changes[key]) && changes[key].length>0) {
        await commit()
        break
      }
    }
    changes = await git.status()
    if (changes.ahead>0) { 
      await push()
    }  
    if (changes.behind>0) { 
      await fetch()  
    }  

  }  
})
.catch( err => {
  if (err.fileName) {
    log('error', `(anonym.js) module: ${err.fileName} line: ${err.lineNumber} \n${format(err)}\n`)
  } else {
    log('error', `(anonym.js) error at start-up\n${format(err)}\n`)
  }
})

