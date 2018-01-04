//NPM
const mssql = require('mssql')
// local
const config = require(`./config.json`)
const api = require('./api.js')
const Pool= mssql.ConnectionPool
const store = require('./store.js')

let pool=undefined
let instanceId=undefined

mssql.on('error', (err) => {
  api.log('warn', `(mssql event) error`)
  api.log('error', err.message)
  api.log('debug', err.stack)
});

module.exports = exports = sqldb = {

  closePool: () => {

    if (pool) {
      pool.close()
      instanceId=undefined
      api.log('debug', `(sqldb.closePool), SQL Server ${api.getInstance()}`)
    }

  },
  isSQL: (tSQL) => {

    return new Promise(function(resolve, reject) {
      if (/NOEXEC/i.test(tSQL)) {
        reject(new Error(`query contains 'NOEXEC' keyword: unable to evaluate`))
      }
      return new mssql.Request(pool).query(`SET NOEXEC ON; ${tSQL}`)
      .then( (nodata) => {   // { recordsets: [], recordset: undefined, output: {}, rowsAffected: [] }
        api.log('debug', `(sqldb.isSQL) valid`.green)
        resolve(true)
      })
      .catch( (err) => {
        api.log('log', `${err.message}`.yellow)
        resolve(false)
      })
    })

  },
  openPool: () => {

    if (api.sqlCatalog.Instance) {
      pool = new Pool(config.mssql.pool, (err) => {
        if (err) {
          api.log('error', `(openPool) error, SQL Server ${api.sqlCatalog.Instance} probe returned an error`)
          api.log('error', err)
        }
      })
      //event speculating, never seen any of 'em so far
      pool.on('error', (err) => {
        api.log('error', `[pool.error event]`.blue+` SQL Server ${api.sqlCatalog.Instance}`.gray)
        api.log('error', err)

      });
      pool.on('connect', (data) => {
        api.log('log', `[pool.connect event]`.blue+` SQL Server ${api.sqlCatalog.Instance}\n\tdata:`.gray)
        api.log('log',  data)
      })
      pool.on('data', (data) => {
        api.log('log', `[pool.data event]`.blue+` SQL Server ${api.sqlCatalog.Instance}\n\tdata:`.gray)
        api.log('log',  data)
      })
      pool.on('disconnect', (data) => {
        api.log('log', `[pool.disconnect event]`.blue+` SQL Server ${api.sqlCatalog.Instance}\n\tdata:`.gray)
        api.log('log',  data)
      })
      pool.on('close', () => {
        api.log('log', `[pool.close event]`.blue+` SQL Server ${api.sqlCatalog.Instance}`.gray)
      })
    }

  },
  batch: (tSQL) => {

    // if (!pool && api.getInstance()) sqldb.openPool()
    if (!tSQL) tSQL=api.compile(config.batch)

    sqldb.isSQL(tSQL)
    .then( (is) => {
      if (is) {
        api.log('debug', `(sqldb.query) ${tSQL}`)
        return new mssql.Request(pool).batch(tSQL)
      }
    })
    .then( (result) => {
      if (result) api.log('log', api.format(result))
      store.batches.put({batch: config.batch, result})
      config.batch.splice(0)
    })
    .catch( (err) => {
      api.log('warn', `(sqldb.batch) query failed at SQL Server`)
      api.log('error', err.message)
      store.batches.put({batch: config.batch, error: err})
    })

  },
  connect: () => {

    if (pool || !pool._connecting) {
      pool.connect()
      api.log('log', `(sqldb.connect), pool re-connect ${api.getInstance()}`)
    } else {
      sqldb.openPool()
    }

  },
  query: (tSQL) => {

    // if (!pool && api.getInstance()) sqldb.openPool()
    if (!tSQL) tSQL=api.compile(config.batch)

    sqldb.isSQL(tSQL)
    .then( (is) => {
      if (is) {
        api.log('debug', `(sqldb.query) ${tSQL}`)
        return new mssql.Request(pool).query(tSQL)
      }
    })
    .then( (result) => {
      if (result) api.log('log', api.format(result))
      store.batches.put({query: config.batch, result})
      config.batch.splice(0)
    })
    .catch( (err) => {
      store.batches.put({query: config.batch, result})
      api.log('warn', `(sqldb.query) query failed at SQL Server`)
      api.log('error', err.message)
    })

  },
  state: () => {

    return !pool?  undefined: !pool._connected? (!pool._connecting? 'closed': 'connecting') : 'connected'

  },
  target: () => {

    // get from pool
    if (pool && sqldb.isSQL('')) {
      api.log('confirm', `connection pool is open, target ${instanceId}`)
    }

  }

}
