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
  isSQL: (tSQL) => {

    function askSQLServer(trySQL) {
      lib.log('debug', `is this tSQL? \n/**********\n` + `${trySQL}`.gray +`\n*********/\n`);
      let checkSQL=`SET NOEXEC ON; ${trySQL}`;
      return new mssql.Request(pool).query(trySQL)
      .then( (nodata) => {   // { recordsets: [], recordset: undefined, output: {}, rowsAffected: [] }
        lib.log('debug', `SQL Server ${config.docker.containerId} parsed & compiled the script,
          unfortunately, `+ `no`.bold.red + ` db object references are verified.`
        );
        return true;
      })
      .catch( (err) => {
        lib.log('warn', `Invalid T-SQL. Batch remains in ${process.env.npm_package_name} cache...`);
        lib.log('error', err.message);
        lib.log('debug', err.stack);
        return false;
      });
    }

    switch (typeof tSQL) {
      case ('undefined'):
        return true;
        break;
      case ('string'):
        return askSQLServer(tSQL);
        break;
      default:
        return false;
        break;
    }

  },
  openPool: (retryCounter=0) => {

    lib.log('debug', `${process.env.npm_package_name} connection pool config:`);
    lib.log('debug', lib.format(sqldb.config));

    pool = new mssql.ConnectionPool(sqldb.config, (err) => {
      if (err) {
        lib.log('warn', `${process.env.npm_package_name} connection pool for SQL Server ${config.docker.containerId} probe returned an error`);
        lib.log('error', err.message);
        lib.log('debug', err.stack);
      } else {
        lib.log('log', `${process.env.npm_package_name} connection pool for SQL Server ${config.docker.containerId} ready`.inverse);
      }
    });

    pool.on('error', (err) => {
      lib.log('warn', `${process.env.npm_package_name} connection pool for SQL Server ${config.docker.containerId} error event`);
      lib.log('error', err.message);
      lib.log('debug', err.stack);
    });

    pool.on('close', () => {
      lib.archiveBatchHistory();
      lib.log('debug', `${process.env.npm_package_name} connection pool for SQL Server ${config.docker.containerId} close event`);
    });

  },
  batch: (tSQL) => {

    if (!tSQL) {
      tSQL=lib.compile(config.cache.batch);
    }
    return sqldb.isSQL(tSQL)
    .then( () => {

      return new mssql.Request(this.pool).batch(tSQL)
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
  query: (tSQL) => {

    if (!tSQL) {
      tSQL=lib.compile(config.cache.batch);
    }
    lib.log(`query: ${tSQL}`);
    return sqldb.isSQL(tSQL)
    .then( (isSQL) => {
      lib.log(`isSQL: ${isSQL}`);
      if (isSQL) {
        return new mssql.Request(pool).query(tSQL)
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
