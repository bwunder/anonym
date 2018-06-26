////NPM
const chalk = require('chalk')
const mssql = require('mssql')
////core
const path= require('path')
////local
const config = require(`../config/config.json`)
const api = require('../lib/api.js')
const store = require('../lib/store.js')

let pool

mssql.on('error', (err) => {
  api.log('warn', `(mssql event) error`)
  api.log('error', err.message)
  api.log('debug', err.stack)
});

function errorhandler(err) {
  if (err.class) {
    if (err.class<16) {
      api.log('warn', `(query) Msg ${err.number}, Level ${err.class} , State ${err.state}, Line ${err.lineNumber}\n${err.message}`)
    } else {
      api.log('error', `(query) Msg ${err.number}, Level ${err.class} , State ${err.state}, Line ${err.lineNumber}\n${err.message}`)
    }
  } else {
    api.log('error', err)
  }
  if (config.vorpal.loglevel===10) {
    api.log('error', api.format(err))
  }
}

module.exports = exports = sqldb = {

  closePool: async (containerId=api.sqlCatalog.Instance) => {

    // never necessary, but might be a reason. Who knows?
    return Promise.resolve(api.sqlCatalog.Pools.get(containerId).close())
    .then( () => {
      api.sqlCatalog.Pools.delete(containerId)
      api.log('log', `(closePool) ${containerId}`)
    })

  },
  isSQL: async (tSQL, containerId=api.sqlCatalog.Instance) => {

    return new Promise( async function(resolve, reject) {
      let reply=true
      try {
        let request=new mssql.Request(pool)
        if (/SET NOEXEC/i.test(tSQL)) {
          api.log('warn', `tSQL evaluation Rejected. 'NOEXEC' keyword may cause unintended query execution.`)
          return resolve(false)
        }
        for (let batch of tSQL.split(/\nGO\n/i)) {
            await request.batch(`SET NOEXEC ON; ${batch}`)
        }
      }
      catch(err) {
        errorhandler(err)
        reply=false
      }
      finally {
        return resolve(reply)
      }
    })

  },
  openPool: async (containerId=api.sqlCatalog.Instance) => {

    return new Promise(async (resolve, reject) => {
      try {
        let info = api.getInstanceInfo(containerId)
        let port = info.Ports[0].PublicPort
        // hardwire for now, but prolly need to allow others
        let user = `sa`
        let password = await api.getEnvVariable(containerId, `$MSSQL_SA_PASSWORD`)
        let cfg = Object.assign(config.mssql.pool, {user, password , port})
        return api.getProcesses()
        .then( async (top) => {
          let sqlBin = await api.getEnvVariable(containerId, `$MSSQL_BIN_DIR`)
          if (top.Processes.length===0 || !top.Processes.join().includes(path.join( sqlBin, `sqlservr`))) {
            reject(new Error(`SQL Server process not detected, Container '${containerId}'`))
          }
          try {
            api.internPool(containerId, cfg)
            if (pool) mssql.close()
            pool = await mssql.connect(api.sqlCatalog.Pools.get(containerId))
            pool.on('error', (err) => {
              api.log('error', chalk`{blue.italic pool error}`+ `${err.originalError.code}: ${err.originalError.message}`)
              api.log('error', err.stack + `\n\n` + new Error().stack)
            })
            let result = await sqldb.query('select db_name() as [database], @@SERVERNAME as [server]')
            if (cfg.database!=result.recordset[0].database) {
              throw(e(`Failed to open Database '${dbName}', using ${result.recordset[0].database} on ${result.recordset[0].server}`))
            }
            resolve(api.log('log', `using ${result.recordset[0].database} on ${result.recordset[0].server}`))
          }
          catch(connectionError) {
            // pool has password in it
            api.log('error', `(openPool) connection failed ${api.format(cfg)}`)
            api.log('error', connectionError)
          }
        })
      }
      catch (err) {
        reject(err)
      }
    })

  },
  batch: async (tSQL, containerId=api.sqlCatalog.Instance) => {

    return new Promise( async function(resolve, reject) {
      let batches= !tSQL? api.compile().split(/\nGO\n/i): tSQL.split(/\nGO\n/i)
      let results=[]
      let request=new mssql.Request(pool)
      request.multiple=true
        for (let batch in batches) {
          try {
            // TODO should/can I stream these out as they run? how much does accumulating swell memory?
            results.push(await request.batch(batches[batch]))
          }
          catch(err) {
            return reject(errorhandler(err))
          }
        }
      api.batch.splice(0)
      return resolve(results)
    })

  },
  query: async (tSQL, containerId=api.sqlCatalog.Instance) => {

    return new Promise( async function(resolve, reject) {
      let results=[]
      let request=new mssql.Request(pool)
      if (!tSQL) tSQL=api.compile()
      if (/\nGO\n/i.test(tSQL)) {
        return resolve(api.log('warn', chalk`(query) UPPERCASE {italic GO} is not recognized by the query engine, this CLI parses
          lowercase {italic.bold go} as a command to run the tSQL now in the Batch.
          Use either the {italic.bold run} or {italic.bold sqlcmd} command to properly execute scripts
          employing {italic GO} separation` ))
      } else {
        try {
          results = await request.query(tSQL)
        }
        catch(err) {
          return reject(errorhandler(err))
        }
      }
      store.batches.put(tSQL, results.rowsAffected)
      api.batch.splice(0)
      return resolve(results)
    })

  },
  state: (containerId=api.sqlCatalog.Instance) => {

    return !api.sqlCatalog.Pools.has(containerId)? 'closed': 'open'

  }

}
