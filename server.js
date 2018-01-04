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
  api.log('debug', err.stack)
  process.emit('exit')
})

process.on('exit', (code) => {

  try {
    if (config.sqlpad[`sqlpad`]) {
      api.log('log', `[exit] sqlpad server at port ${config.vantage.port} ending`.cyan.bgGray)
      config.sqlpad.sqlpad.kill()
      config.sqlpad.sqlpad=undefined
    }
    if (config.tail) {
      api.log('log', `[exit] tail following SQL Server ${config.tail} ending`.blue.bgGrey)
      config.tail.kill()
      config.tail=undefined
    }
    api.log('log', `sqlpal at port ${config.vantage.port} ending with code: ${code}`)
  }
  catch (err) {
    console.error(err)
  }

})

api.loadCatalog()
if (config.sqlpad.enabled) {
  api.startSQLPad()
}
