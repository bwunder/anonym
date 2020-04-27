//// NPM
const simpleGit = require('simple-git/promise')
//// CORE
//// LOCAL
const { attachDocker, shell } = require('../lib/api')
const { sql } = require('../lib/catalog') 
const cli = require('../lib/cli')
const { format, log } = require('../lib/log')
const { sqlpad, map } = require('../lib/sqlpad')
const { compactAll, errors, lines, words } = require('../lib/store')

const config = require('../config/config.json')

const git = simpleGit(process.cwd())

const pushChanges = async () => {
  
log('log', `git status ${format(await git.status())}`)
  
  return git.add('.')
  .then( (result) => {
  
log('info', `(pushChanges) result ${result}`)      
  
    return git.commit('changes detected at anonym shutdown')
  })
  .then( async () => {
    if (config.git.origin && await repo.git.status().ahead>0) {
      return git.push('origin', 'master')
    }  
  })
  .catch( err => log('error', `(pushChanges) error\n${format(error)}`))  
}

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
    // archive tracked changes
    log('log', `git status ${format(await git.status())}`)
    return git.status() //pushChanges()
    .then( (result) => {
log('info', result)      
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

// record the app start
lines.put(process.argv)

return git.checkIsRepo()
.then( async (isRepo) => {
  if (!isRepo && config.git.origin) {
    return shell('git config --get --local user.name')
    .then( async (user) => {
      if (typeof user==='undefined') await git.init()
      await git.addConfig('user.name', config.git.user)
      await git.addConfig('user.email', config.git.email)
// ?      const remote = `https://${config.git.user}:${Promise.resolve(words.getLast('remote'))}@${config.git.origin}`;
    })
    .catch( err => log('error', `(anonym.js) repo initilization failed\n${format(err)}`))
  }  
  log('log', `git status ${format(await git.status())}`)
  pushChanges()
  await attachDocker()
  if (config.sqlpad.runAtStartup) await map()
  cli.show()
})
.catch( err => {
  if (err.fileName) {
    log('error', `(anonym.js) module: ${err.fileName} line: ${err.lineNumber} \n${format(err)}\n`)
  } else {
    log('error', `(anonym.js) error at start-up\n${format(err)}\n`)
  }
})

