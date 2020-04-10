//// NPM
//// CORE
const path = require('path')
//// LOCAL
const { attachDocker, openInstance } = require('./lib/api')
const { sql, intern, isHost } = require('./lib/catalog') 
const cli = require('./lib/cli')
const { format, log } = require('./lib/log')
const repo = require('./lib/repo')
const { map } = require('./lib/sqlpad')
const { compactAll, errors, lines } = require('./lib/store')
const { ucons } = require('./lib/viewer')

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

process.on('exit', code => {
  try {
    if (sqlpad.sqlpad) sqlpad.sqlpad.kill(1)
    if (sql.Pools && sql.Pools.size > 0) {
      for (let pool in sql.Pools) {
        log('confirm', `(anonym.js.process_exit) Closing connection pool ${pool[0]}...\n`)
        pool[1].close()
      }
    }
  
    // TODO !!! always commit changes from the clone to local the local repo !!!
  
    // nedb maintenance
    return compactAll()
    .then(() => {
      log('exit', `exit code: ${code}\n`)
    })  
  }
  catch(err) {
    log('error', `(anonym.js) error at shut-down\n${format(err)}\n`)
  }
})


// TODO !!! if no config repo URI, init git in the folder with no remote) local repo !!!
// ??? make it so remote is added if/when URI is detected, not exactly sure how this or github password will go just yet ??? 
// log('confirm', format(repo)) // ✔  { author: [AsyncFunction: author], commit: [AsyncFunction: commit], newLocal: [AsyncFunction: newLocal], cloneAnonym: [AsyncFunction: cloneAnonym] }

// sidle up to the dockerd
return (isHost())
.then( async (ping) => {
  // record the app start
  lines.put(process.argv)
  if (ping) {
    await api.attachDocker()
    await sqlpad.map()
  }
  // listen for user input
  cli.show()
})  
.catch( err => {
  if (err.fileName) {
    log('error', `(anonym.js) module: ${err.fileName} line: ${err.lineNumber} \n${format(err)}\n`)
  } else {
    log('error', `(anonym.js) error at start-up\n${format(err)}\n`)
  }
})

