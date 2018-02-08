////NPM
const mssql = require('mssql')
////core
const path= require('path')
////local
const config = require(`./config.json`)
const api = require('./api.js')
const store = require('./store.js')

const Pool= mssql.ConnectionPool
let pool
let instanceId=api.sqlCatalog.Instance
let db=config.mssql.pool.database

mssql.on('error', (err) => {
  api.log('warn', `(mssql event) error`)
  api.log('error', err.message)
  api.log('debug', err.stack)
});

module.exports = exports = sqldb = {

  closePool: async () => {

    return Promise.resolve(pool.close())
    .then( () => {
      api.log('log', `(closePool) ${api.sqlCatalog.Instance}`)
    })

  },
  isSQL: async (tSQL) => {

    return new Promise(function(resolve, reject) {
      if (/NOEXEC/i.test(tSQL)) {
        // allowing NOEXEC could 'inappropriately' let tSQL execute
        api.log('warn', `unable to evaluate batch: includes 'NOEXEC' keyword`.red)
        resolve(false)
      }
      return new mssql.Request(pool).query(`SET NOEXEC ON; ${tSQL}`)
      .then( (nodata) => {  // { recordsets: [], recordset: undefined, output: {}, rowsAffected: [] }
        api.log('debug', `(isSQL) valid`.green)
        resolve(true)
      })
      .catch( (err) => {
        api.log('warn', `(isSQL) ${err.message}`.yellow)
        if (config.vorpal.loglevel=10) {
          api.log('warn', api.format(err).yellow)
        }
        resolve(false)
      })
    })

  },
  openPool: async (dbName=config.mssql.pool.database, port) => {

    return new Promise(async (resolve, reject) => {
      try {
        let top=await api.getProcesses()
        // might still not be clean enough??
        if (api.sqlCatalog.Instance &&
            api.getContainerInfo().State==='running' &&
            top.Processes.join().includes(`/opt/mssql/bin/sqlservr`)) {
          if (pool) await sqldb.closePool()
          config.mssql.pool.port=api.getContainerInfo().Ports[0].PublicPort
          if (!config.mssql.pool.port) throw (new Error('SQL Server Port Not Found'))
          config.mssql.pool.database=dbName
          instanceId=api.sqlCatalog.Instance
          pool = new Pool(config.mssql.pool, (err) => {
            if (err) {
              api.log('warn', `(openPool) probe fault ${instanceId}\n`+`\t[${err.code}]: ${err.message}`.red)
              reject(err)
            }
          })
          pool.on('error', (err) => {
            api.log('error', `[pool error]`.blue+ `${err.originalError.code}: ${err.originalError.message}`)
            api.log('error', new Error(err.message).stack)
          });
          //event speculating, not seen any of 'em so far
          pool.on('connect', (data) => {
            api.log('log', `[pool connect]`.blue+` SQL Server ${instanceId}\n\tdata:`.gray)
            api.log('log',  data)
          })
          pool.on('data', (data) => {
            api.log('log', `[pool data]`.blue+` SQL Server ${instanceId}\n\tdata:`.gray)
            api.log('log',  data)
          })
          pool.on('disconnect', () => {
            api.log('log', `[pool disconnect]`.blue+` SQL Server ${instanceId}\n\tdata:`.gray)
          })
          pool.on('close', () => {
            api.log('log', `[pool close]`.blue+` SQL Server ${instanceId}`.gray)
          })
          resolve(`using ${dbName}`)
        }
      }
      catch (err) {
        reject(err)
      }
    })

  },
  batch: async (tSQL) => {

    return new Promise( async (resolve, reject) => {
      if (!tSQL) tSQL=api.compile(config.batch)
      if (await sqldb.isSQL(tSQL))  {
        return new mssql.Request(pool).batch(tSQL)
        .then( (result) => {
          store.batches.put({batch: config.batch, result})
          config.batch.splice(0)
          return resolve(result)
        })
        .catch( (err) => {
          reject(err)
        })
      } else {
        reject('(sqldb.batch) Target Instance cannot compile the Batch')
      }
    })

  },
  connect: async () => {

    return new Promise( async (resolve, reject) => {
      try {
        if (pool) {
          await pool.connect()
          resolve(api.log('log', `(sqldb.connect) pool re-connect ${api.sqlCatalog.Instance}`))
        } else {
          await sqldb.openPool()
          resolve(api.log('log', `(sqldb.connect) pool connect ${api.sqlCatalog.Instance}`))
        }
      }
      catch(err) {
        reject(err)
      }
    })

  },
  query: async (tSQL) => {

    return new Promise( async (resolve, reject) => {
      if (!tSQL) tSQL=api.compile(config.batch)
      if (await sqldb.isSQL(tSQL))  {
        return new mssql.Request(pool).query(tSQL)
        .then( (result) => {
          store.batches.put({batch: config.batch, result})
          config.batch.splice(0)
          return resolve(result)
        })
        .catch( (err) => {
          reject(err)
        })
      } else {
        reject('(sqldb.query) Target Instance cannot compile the Batch')
      }
    })

  },
  state: () => {

    return !pool?  undefined: !pool._connected? (!pool._connecting? 'closed': 'connecting') : 'connected'

  },
  target: () => {

    if (pool && sqldb.isSQL('')) {
      // api.log('confirm', `connection pool is open, target ${instanceId}`)
      return instanceId
    }

  }

}
