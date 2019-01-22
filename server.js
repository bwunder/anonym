////local
const api = require('./lib/api')
const catalog = require('./lib/catalog') 
const cli = require('./lib/commands')
const { format, log } = require('./lib/log')
const store = require('./lib/store')
const tls = require('./lib/tls') 

const config = require('./config/config.json')

process.on('unhandledRejection', err => {
  store.errors.put(err)
  log('log', `\u274E (server) process_unhandledRejection\n${format(err)}\n`)
})

process.on('error', err => {
  store.errors.put(err)
  log('log', `(process_error) \n${format(err)}\n`)
})

process.on('exit', async code => {
  if (sqlpad.sqlpad) sqlpad.sqlpad.kill(1)
  if (catalog.sql.Pools && catalog.sql.Pools.size > 0) {
    for (let pool in catalog.sql.Pools) {
      log('log', `\u2718 close connection pool ${pool[0]}...\n`)
      pool[1].close()
    }
  }
  await store.compactAll()
  log('log', `\n\u2BA8  exit code: ${code}\n`)
})

tls.genCA()
  .then( async () => {
    await api.attachDocker()
      if (await catalog.intern()) {
        await api.openInstance(catalog.sql.Instance)
    }
    if (config.sqlpad.runAtStartup) {
      let sqlpad = require('./lib/sqlpad')
      await sqlpad.start(path.resolve(config.docker.bindings.private.mount.Source))
    }
    cli.execSync('about version')
  })
  .catch( err => {
    log('error', err)
  })
