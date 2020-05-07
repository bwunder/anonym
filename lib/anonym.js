//// NPM
//// CORE
//// LOCAL
const { attachDocker } = require('../lib/api')
const { sql } = require('../lib/catalog') 
const cli = require('../lib/cli')
const { format, log } = require('../lib/log')
const { add, commit } = require('../lib/repo')
const { sqlpad, map } = require('../lib/sqlpad')
const { compactAll, errors, lines } = require('../lib/store')

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
    return add()
    .then( async () => {
      await commit()
      await compactAll()
      if (sqlpad) sqlpad.kill(1)
      log('exit', `exit code: ${code}\n`)
    })
    .catch( err => log('error', `(anonym.js) exit task failed\n${format(error)}`))  
  }
  catch(err) {
    log('error', `(anonym.js) error on exit\n${format(err)}\n`)
  }
})

return add()
.then( async () => {
  try {
    lines.put(process.argv)                         // log startup commandline
    await commit()
    if (config.sqlpad.runAtStartup) await map()     // launch UI Express server 
    await attachDocker()                            // prepare for container IPC   
    cli.show()                                      // open CLI prompt
  }
  catch(err) {
    if (err.fileName) {
      log('error', `(anonym.js) module: ${err.fileName} line: ${err.lineNumber} \n${format(err)}\n`)
    } else {
      log('error', `(anonym.js) error at start-up\n${format(err)}\n`)
    }
  }
})

