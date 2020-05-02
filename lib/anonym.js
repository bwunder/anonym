//// NPM
//// CORE
//// LOCAL
const { attachDocker, shell } = require('../lib/api')
const { sql } = require('../lib/catalog') 
const cli = require('../lib/cli')
const { format, log } = require('../lib/log')
const { commit, git } = require('../lib/repo')
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
    return git.status() //pushChanges()
    .then( (result) => {
      log('exit', `(exit) git status result`)      
      return git.commit('changes detected at anonym shutdown')
    })
    .then( async () => {
      if (config.git.origin && await repo.git.status().ahead>0) {
        return git.push('origin', 'master')
      }  
    })
    .then( () => {
      // nedb maintenance
      return compactAll()
    })
    .then(() => {
      log('exit', `exit code: ${code}\n`)
      if (sqlpad) sqlpad.kill(1)
    })
    .catch( err => log('error', `(exit) error: ${format(error)}`))  
  }
  catch(err) {
    log('error', `(anonym.js) error at shut-down\n${format(err)}\n`)
  }
})

// log app startup commandline
lines.put(process.argv)
return git.checkIsRepo()
.then( async (isRepo) => {
  if (!isRepo && config.git.origin) {
    return shell('git config --get --local user.name')
    .then( async (user) => {
      if (typeof user==='undefined') await git.init()
    })
    .catch( err => log('error', `(anonym.js) repo initilization failed\n${format(err)}`))
  }  
  const status = await git.status()
  cli.show()
  for (const key of Object.keys(status)) {
    if (Array.isArray(status[key]) && status[key].length>0) {
      log('log', `Commit to local git ${format(await git.status())}`)
      commit()
      break
    }
  }
  if (status.ahead>0 || status.behind>0) {
    log('warn', `git repository is not in sync with Remote (ahead=${status.ahead}, behind=${status.behind})`)  
  }  
  await attachDocker()
  if (config.sqlpad.runAtStartup) await map()
})
.catch( err => {
  if (err.fileName) {
    log('error', `(anonym.js) module: ${err.fileName} line: ${err.lineNumber} \n${format(err)}\n`)
  } else {
    log('error', `(anonym.js) error at start-up\n${format(err)}\n`)
  }
})

