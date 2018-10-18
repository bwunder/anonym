////NPM
const chalk = require('chalk')
const mssql = require('mssql')
////CORE
const { inspect } = require('util')
const os = require('os')
////LOCAL
const config = require('../config/config.json')
// wrong, cant see catalog from here
const api = require('../lib/api')

const errorhandler = err => {
  switch(true) {
  case (typeof err.class!=='undefined'): // query
    process.stderr.write(chalk`{rgb(255, 136, 0) \u2BA9}  SQL Server error 
      Nbr:   ${err.number} 
      Class: ${err.class} 
      State: ${err.state} 
      Line:  ${err.lineNumber}
      Msg:   ${err.message}\n`)
    break  
  case (typeof err.code!=='undefined'): // OS
    process.stderr.write(chalk`{rgb(255, 136, 0) \u2BA9}  OS error, code ${err.code}
      ${os.constants.err?os.constants.err.nbr[err.code]:inspect(err)}\n`)
    break
  default:
    process.stderr.write(chalk`{rgb(255, 136, 0) \u2BA9}  error\n${inspect(err)}\n`)
    break  
  }
  return
}

// pool is cataloged upon successful connection of a batch to fetch the servername at openInstance
// batches connect and disconnect, the pool is a client thing with no persistent db connection 
// pools are mssql layer convenience enhancement to core package duities as tedious.js wrapper    
// seems to be a breaking change in switch from atom to vscode (or my prolly messed up by me node install)
// -v says I am running at 8.11.3 after deleting node v11 from githib clone make from local 
// and with yast uninstalling installed node, still see tiny node ang big node8 exe in usr/bin  
// and modules in /usr/lib64
const sqldb = {

  isSQL: (tSQL, target) => {

    return new Promise(async(resolve, reject) => {
      try {
        if (typeof tSQL==='undefined' || /NOEXEC/i.test(tSQL)) resolve(false)
        let batch
        let request=new mssql.Request(api.sqlCatalog.Pools.get(target))
        request.multiple=true
        try {
          for (batch of tSQL.split(/\nGO\n/i)) {
            // TODO stream these out as they run instead of this potential ram bubble
            await request.batch(`SET NOEXEC ON; ${batch}; SET NOEXEC OFF`)
          }
          resolve(true)
        }  
        catch(err) {
          if (batch!==tSQL) {
            errorhandler(new Error(`(isSQL) Validation failed at batch:\nbatch`))
          }
          errorhandler(err)
          resolve(false)
        }
      }  
      catch(er) {
        reject(er)
      }

    })

  },
  openPool: async (poolOptions) => {

    return new Promise( async function(resolve, reject) {
      try {
        // get poolOptions with a port from api.openInstance() and let it map result  
        // port implys localhost could alternately spec a servername or servername/instance
        let pool = new mssql.ConnectionPool(poolOptions) 
        pool.on('error', (err) => {
          process.stderr.write(chalk`{rgb(255, 136, 0) \u2BA9}  {red ${err.originalError.code}}: ${err.originalError.message}`)
          errorhandler(err)
        })
        await pool.connect()
        let request=new mssql.Request(pool)
        let result = await request.query('select db_name() as [database], @@SERVERNAME as [server]')
        if (poolOptions.database && poolOptions.database!==result.recordset[0].database) {
          errorhandler(new Error(`Failed to open Database '${config.mssql.pool.database}'`))
        }
        process.stdout.write(chalk`{rgb(255, 136, 0) \u2BA9}  Pool open: db ${result.recordset[0].database} in sql container ${result.recordset[0].server}\n`)
        return resolve(pool)
      }
      catch(connectionError) {
        return reject(errorhandler(connectionError))
      }
    })  

  },
  batch: async (tSQL, target) => {

    return new Promise( async function(resolve, reject) {
      let ok = true
      let results = []
      let request = new mssql.Request(api.sqlCatalog.Pools.get(target))
      request.multiple=true
      if (config.cli.alwaysCheckSyntax) {
        ok = await sqldb.isSQL(tSQL, target) // will show first failing batch
      }
      if (ok) {
        for (let batch of tSQL.split(/\nGO\n/i)) {
          try {
            // TODO stream this output instead of possibly bloating the buffer
            results.push(await request.batch(batch))
          }
          catch(err) {
            errorhandler(err)
            errorhandler(new Error(` ok is ${ok} (batch) execution failure- investigate for possible corruption:\n${batch}`))
            reject()
          }
          return resolve(results)
        } 
      } else {
        errorhandler(new Error(`(batch) Did not validate, execution is pre-empted`))
        reject()
      }  
    })

  },
  query: async (tSQL, target) => {

    return new Promise( async function(resolve, reject) {
      if (/\nGO\n/i.test(tSQL) || /\nUSE\n/i.test(tSQL)) {
        return reject(new Error(chalk`The 'GO' batch terminator is not permitted when submitted 
        with the {italic.bold go} CLI command (uses mssql.Request.query). The {italic.bold run} (using mssql.Request.batch) or 
        {italic.bold sqlcmd} CLI commands can execute scripts that include 'GO' separated batches.`))
      } else {
        try {
          let ok = true
          if (config.cli.alwaysCheckSyntax) {
            ok = await sqldb.isSQL(tSQL, target)
          }
          if (ok) {
            let request = new mssql.Request(api.sqlCatalog.Pools.get(target)).query(tSQL)
            resolve(await request)
          } else {
            reject(new Error('(query) Did not validate, execution is prempted'))
          }
        }
        catch(err) {
          errorhandler(err)
          reject(new Error(`(query) failed while executing - note: config.cli.alwaysCheckSyntax is ${config.cli.alwaysCheckSyntax}`))
        }
      }
    })
  
  }

}

module.exports = sqldb