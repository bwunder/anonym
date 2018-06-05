const chalk = require(`chalk`)
const config = require(`./config/config.json`)
const api = require(`./lib/api.js`)
const cli = require(`./lib/commands.js`)
const store = require(`./lib/store.js`)

process.on('unhandledRejection', (err) => {
  store.errors.put(err)
//  store.errors.put(new Error(err.message))
  api.log('error', 'Unhandled Promise Rejection handled')
  api.log('error', err.message)
  api.log('log', new Error(err.stack).stack)
//  api.log('error', new Error(err.message))
})

process.on('error', (err) => {
  store.errors.put(err)
  api.log('warn', 'process error')
  api.log('error', err.message)
//  api.log('log', err.stack)
  api.log('log', new Error(err.stack).stack)
//  process.emit('exit')
})

process.on('exit', (code) => {
  if (api.sqlpad) {
    api.log('log', chalk`{italic (exit)} {red.bgBlackBright.inverse stop} sqlpad server`)
    api.sqlpad.kill(1)
  }
  if (config.tail) {
    api.log('log', chalk`{italic (exit)} {red.bgBlackBright.inverse kill} process following SQL Server errorlog}`)
    config.tail.kill(1)
  }
  if (api.sqlCatalog.Pools && api.sqlCatalog.Pools.size > 0) {
    for (let pool in api.sqlCatalog.Pools) {
      api.log('log', chalk`{italic (exit)} {red.bgBlackBright.inverse close} connection pool ${pool[0]}`)
      // slim chance but could spin on a running query I reckon???
      pool[1].close()
    }
  }

  api.log('log', chalk`{italic (exit)} sqlpal exit code ${code}`)
  // a couple of phantom exits of code 0. both during startInstance I think?
  // 2nd was for sure at start of unstarted and it did start but did not output any tail???
  // can't repro so will try putting up with a stack trace here for a while
  api.log('confirm', new Error().stack)
})

// add an _id as config.target to hardwire a SQL Server
// otherwise will try to connect to last target
api.intern(config.target)
.then(() => {
  // SQLPad becomes child process, not using globally (-g) installed,
  if (config.sqlpad.enabledAtStartup) {
    api.startSQLPad()
  }
})
