const config = require(`./config.json`)
const api = require(`./api.js`)
const cli = require(`./commands.js`)

process.on('unhandledRejection', (error) => {
  api.log('warn', 'process unhandledRejection')
  api.log('error', error)
})

process.on('error', (err) => {
  api.log('warn', 'process error')
  api.log('error', err.message)
  api.log('log', new Error().stack)
  api.log('debug', err.stack)
  process.emit('exit')
})

process.on('exit', (code) => {

  // try {
    store.configs.put(config)
    if (config.sqlpad[`sqlpad`]) {
      api.log('log', `[exit] sqlpad server at port ${config.vorpal.port}`.cyan.bgGray)
      config.sqlpad.sqlpad.kill()
    }
    if (config.tail) {
      api.log('log', `[exit] errorlog tail ending :SQL Server  ${config.tail}`.blue.bgGrey)
      config.tail.kill()
    }
    api.log('log', `[exit] sqlpal at port ${config.vorpal.port} ending with code: ${code}`)

})
// add config.target key to explicitly set a start-up SQL Server
// o'wise use found if only one or complain about the confusion
api.loadCatalog(config.target)
if (config.sqlpad.enabled) {
  api.startSQLPad()
}
