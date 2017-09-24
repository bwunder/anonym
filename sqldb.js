//NPM
const mssql = require('mssql');
const Promise = require('bluebird');
mssql.Promise = Promise;
// local
const config = require(`./config.json`);
const lib = require('./lib.js');


mssql.on('error', err => {

  lib.log('warn', `${process.env.npm_package_name} mssql driver error`);
  lib.log('error', err.message);
  lib.log('debug', err.stack);

});

var pool={};

module.exports = exports = sqldb = {

  config: {

    user: config.sqlcmd.switch.U || config.mssql.sa.name,
    password: !config.sqlcmd.switch.U? config.mssql.sa.password: config.sqlcmd.switch.P,
    server: config.sqlcmd.switch.S,
    database: config.sqlcmd.switch.d,
    pool: config.odbc.pool

  },
  closePool: (pool) => {

    if (pool) {
      pool.close();
    }

  },
  isSQL: () => {

    if (config.cache.batch.length>0) {
      lib.log('debug', `(query)`+lib.compile([`SET NOEXEC ON;`].concat(config.cache.Batch)));
      return new mssql.Request(pool).query(lib.compile([`SET NOEXEC ON;`].concat(config.cache.Batch)))
      .then( (nodata) => {   // { recordsets: [], recordset: undefined, output: {}, rowsAffected: [] }
        lib.log('debug', `SQL Server believes the batch to be valid T-SQL,
          db object references, however, have `.italic + `not`.bold.underline.red + ` been verified`.italic);
        return true;
      })
      .catch( (err) => {
        lib.log('warn', `Invalid T-SQL. Batch remains in ${process.env.npm_package_name} cache...`);
        lib.log('error', err.message);
        lib.log('debug', err.stack);
        return false;
      });
    }

  },
  openPool: (retryCounter=0) => {

    lib.log('debug', `${process.env.npm_package_name} connection pool config:`);
    lib.log('debug', lib.format(sqldb.config));

    lib.log('debug', 'pool b4 new pool');
    lib.log('debug', pool);

    pool = new mssql.ConnectionPool(sqldb.config, (err) => {
      if (err) {
        lib.log('warn', `${process.env.npm_package_name} connection pool probe returned an error`);
        lib.log('error', err.message);
        lib.log('debug', err.stack);
      } else {
        lib.log('log', `${process.env.npm_package_name} connection pool is opened`.inverse);
      }
    });

    pool.on('error', (err) => {
      lib.log('warn', `${process.env.npm_package_name} connection pool error event`);
      lib.log('error', err.message);
      lib.log('debug', err.stack);
    });

    pool.on('close', () => {
      lib.archiveBatchHistory();
      lib.log('debug', `${process.env.npm_package_name} connection pool close event`);
    });

  },
  batch: () => {

    return sqldb.isSQL()
    .then( () => {

      return new mssql.Request(this.pool).batch(lib.compile(config.cache.batch))
      .then( (results) => {
        lib.log('log', lib.format(results));
        lib.archiveBatch();
        return true
      });

    })
    .catch( (err) => {
      lib.log('warn', `${process.env.npm_package_name} batch failed to execute`);
      lib.log('error', err.message);
      lib.log('debug', err.stack);
    });

  },
  connect: () => {

    if (pool) {
      pool.connect();
      lib.log('debug', `${process.env.npm_package_name} connection pool for SQL Server ${config.docker.containerId} now accepting connections`);
    } else {
      lib.log('error', `no pool found for ${process.env.npm_package_name} connection pool to SQL Server ${config.docker.containerId}`);
    }

  },
  query: () => {

    lib.log(`sqldb.isSQL: ${sqldb.isSQL}`);
    return sqldb.isSQL()
    .then( (isSQL) => {
      lib.log(`isSQL: ${isSQL}`);
      if (isSQL) {
        return new mssql.Request(pool).query(lib.compile(config.cache.batch))
      }
    })
    .then( (results) => {
      if (results) lib.log('log', lib.format(results));
      lib.archiveBatch();
    })
    .catch( (err) => {
      lib.log('warn', '${process.env.npm_package_name} query failed to execute');
      lib.log('error', err.message);
      lib.log('debug', err.stack);
    });

  }

}
