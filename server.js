const chalk = require(`chalk`)
const config = require(`./config.json`)
const api = require(`./api.js`)
//fails at first api.log reference at startup w/out the cli include
// ??? vorpal-log dependency ???
const cli = require(`./commands.js`)
const store = require(`./store.js`)

process.on('unhandledRejection', (err) => {
  store.errors.put(new Error(err.message))
  api.log('error', new Error(err.message))
  store.errors.put(err)
  api.log('error', err)
})

process.on('error', (err) => {
  store.errors.put(err)
  api.log('warn', 'process error')
  api.log('error', err.message)
  api.log('debug', err.stack)
  api.log('log', new Error().stack)
  //process.emit('exit')
})

process.on('exit', (code) => {
  if (config.sqlpad[`sqlpad`]) {
    api.log('log', chalk`{italic (exit)} {red.bgBlackBright.inverse stop} sqlpad server`)
    config.sqlpad.sqlpad.kill(1)
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
})

// hardwire a start-up SQL Server - o'wise uses last
api.intern(config.target)
.then( () => {
  // SQLPad in here becomes child process, not using global (-g),
  // can it be obliviously started - or stopped - on demand even when global is also installed  ???
  // if true, could be a security hole in some environs to depend on any  
  if (config.sqlpad.enabledAtStartup) {
    api.startSQLPad()
  }
})
