////local
const api = require('./lib/api')
const store = require('./lib/store')
const cli = require('./lib/commands')
const sqldb = require('./lib/sqldb')

const sqlpad = require('./config/sqlpad.json')

process.on('unhandledRejection', err => {

  store.errors.put(err)
  process.stdout.write(`(process_unhandledRejection) \n${err.stack}\n`)

})

process.on('error', err => {

  store.errors.put(err)
  process.stdout.write(`(process_error) \n${err.stack}\n`)

})

process.on('exit', async code => {

  if (sqlpad.sqlpad) sqlpad.sqlpad.kill(1)
  if (api.sqlCatalog.Pools && api.sqlCatalog.Pools.size > 0) {
    for (let pool in api.sqlCatalog.Pools) {
      process.stdout.write(`\u2718 close connection pool ${pool[0]}...\n`)
      pool[1].close()
    }
  }
  await store.compactAll()
  process.stdout.write(`\n\u2BA8  exit code: ${code}\n`)

})

