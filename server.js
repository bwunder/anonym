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
  api.log('log', err.stack)
  api.log('log', new Error().stack)
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
    api.log('log', chalk`{italic.bold (exit)} {red stop} sqlpad server`)
    api.sqlpad.kill(1)
  }
  if (config.tail) {
    api.log('log', chalk`{italic.bold (exit)} {red kill} process following SQL Server errorlog}`)
    config.tail.kill(1)
  }
  if (api.sqlCatalog.Pools && api.sqlCatalog.Pools.size > 0) {
    for (let pool in api.sqlCatalog.Pools) {
      api.log('log', chalk`{italic.bold (exit)} {red close} connection pool ${pool[0]}`)
      // pool state doesn't really matter if no active queries: memory object
      pool[1].close()
      // anticipte sql blocking holding pool if queries running, transactions open, etc. but have not seen any - yet
      // setTimeout()
    }
  }
  console.log(chalk`{italic.bold (exit)} code: ${code} \n${api.bandAid}`)
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
