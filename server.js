////NPM
const chalk = require('chalk')
////local
const {log, format, sqlCatalog} = require('./lib/api')
const { errors } = require('./lib/store')

const config = require('./config/config.json')

process.on('unhandledRejection', (err) => {
  errors.put(err)
  log('error', format(err))
  log('error', format(new Error(`UnhandledRejection handler supplement`)))
})

process.on('error', (err) => {
  errors.put(err)
  log('error', `(process) error\n${format(err)}`)
  log('error', format(new Error(`Process error handler supplement`)))
})

process.on('exit', (code) => {
//  let haveWaited = 0
  if (config.sqlpad.sqlpad) {
    log('log', chalk`\u2BA8 {inverse.red stop} sqlpad server\n`)
    config.sqlpad.sqlpad.kill(1)
  }
  if (sqlCatalog.Pools && sqlCatalog.Pools.size > 0) {
    for (let pool in sqlCatalog.Pools) {
      log('log', chalk`\u2BA8 {inverse.red close} connection pool ${pool[0]}...\n`)
      // pool state doesn't really matter if no active queries: memory object
      // expecting close() to spin on running queries
      pool[1].close()
    }
  }
  // If sql blocking holds pool open (queries running, transactions open, etc.) could be bad or good!
 // but I never tested and it look awful! don't think I ever saw it run anyway  - have commented it out for now
  // let interval = 500
  // setInterval(() => {
  //   let waiting = false
  //   let waitforit = Math.round(config.pool.closeTimeoutMillis/3)
  //   // ?  
  //   process.stdout.write('.')
  //   if (haveWaited >= config.pool.closeTimeoutMillis - waitforit) {
  //     if (!waiting) {
  //       waiting = true
  //       setTimeout(() => {
  //         process.abort()
  //       }, waitforit)
  //     }
  //   }
  //   haveWaited += interval
  // }, interval)
  process.stdout.write(chalk`\u2BA8  code: ${code}`)
})

require('./lib/commands')
