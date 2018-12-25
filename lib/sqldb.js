////NPM
const chalk = require('chalk')
const mssql = require('mssql')
////CORE
//const { inspect } = require('util')
const { constants } = require('os')
////LOCAL
const config = require('../config/config.json')
const api = require('../lib/api')

// the one active pool allowed per mssql instatiation
var pool

const errorhandler = err => {
  try {
    switch(true) {
      case (typeof err.class!=='undefined'): // query 
        api.log('log', chalk`{rgb(255, 136, 0) \u2A1D}  SQL Server error 
          Number:  ${err.number} 
          Class:   ${err.class} 
          State:   ${err.state} 
          Line:    ${err.lineNumber}
          Message: ${err.message}\n`)
        break  
      case (typeof err.code!=='undefined'): // OS
        api.log('log', chalk`{rgb(255, 136, 0) \u2A1D}  OS error, code ${err.code}
          ${constants.err?constants.err.nbr[err.code]:api.format(err)}\n`)
        break
      default:
        api.log('log', chalk`{rgb(255, 136, 0) \u2A1D}  error\n${api.format(err)}\n`)
        break  
      }    
  }
  catch(e) {
    process.stderr.write(`errorhandler threw: ${e.message}`)
    //try write orig error to stdout 
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
          ${constants.err?constants.err.nbr[err.code]:inspect(err)}\n`)
        break
      default:
        process.stderr.write(chalk`{rgb(255, 136, 0) \u2BA9}  error\n${inspect(err)}\n`)
        break  
      }
  }
  return
}

const sqldb = {

  isSQL: (tSQL, target) => {

    return new Promise( async (resolve, reject) => {
      try {
        if (typeof tSQL==='undefined' || /NOEXEC/i.test(tSQL)) resolve(false)
        let batch
        let request=new mssql.Request(pool)
        request.multiple=true
        try {
          for (batch of tSQL.split(/\nGO\n/i)) {
            if (batch.trimRight().endsWith('GO')) {
              batch = batch.substring(0, batch.trimRight().length-3)
            }
            // will fail if last line is GO (no crlf after) or GO line has white space
            // TODO stream these out as they run instead of this potential ram bubble
            await request.batch(`SET NOEXEC ON;\n${batch};\nSET NOEXEC OFF;`)
          }
          resolve(true)
        }  
        catch(err) {
          if (err.code && err.code==='ECONNCLOSED') { 
            reject(err)           
          } else {
            if (batch!==tSQL) {
              errorhandler(new Error(`(isSQL) Validation failed for batch`))
            }
            errorhandler(err)
            resolve(false)
          }  
        }
      }  
      catch(er) {
        reject(er)
      }

    })

  },
  openPool: async options => {

    return new Promise( async (resolve, reject) => {
      try {
        if (pool) pool.close()
        pool = new mssql.ConnectionPool(options) 
        pool.on('error', (err) => {
          process.stderr.write(chalk`{rgb(255, 136, 0) \u2A1D}  {red ${err.originalError.code}}: ${err.originalError.message}`)
          errorhandler(err)
        })
        await pool.connect()
        let request = new mssql.Request(pool)
        let result = await request.query(`select db_name() as [database], SERVERPROPERTY('ServerName') AS [server]`)
        if (options.database && options.database!==result.recordset[0].database) {
          errorhandler(new Error(`Failed to open Database '${config.mssql.pool.database}', using '${result.recordset[0].database}'`))
        }
        process.stdout.write(chalk`{rgb(255, 136, 0) \u2A1D}  Pool open: db ${result.recordset[0].database} in sql container ${result.recordset[0].server}\n`)
        return resolve(pool)
      }
      catch(connectionError) {
        return reject(errorhandler(connectionError))
      }
    })  

  },
  batch: async (tSQL, target) => {

    return new Promise( async (resolve, reject) => {
      let batch
      let ok = true
      let results = []
      let request = new mssql.Request(pool)
      //request.multiple=true // the default i suspect for guery and batch - result object always has placeholder
      if (config.cli.checkSyntax) {
        ok = await sqldb.isSQL(tSQL, target) // first failing batch
      }
      if (ok) {
        for (batch of tSQL.split(/\nGO\n/i)) {
          try {
            results.push(await request.batch(batch))
          }
          catch(err) {
            errorhandler(err)
            errorhandler(new Error(`(batch)\n${batch}`))
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

    return new Promise( async (resolve, reject) => {
      if (/\nGO\n/i.test(tSQL) || /\nUSE\n/i.test(tSQL)) {
        return reject(new Error(chalk`The 'GO' batch terminator is not permitted when submitted 
        with the {italic.bold go} CLI command (uses mssql.Request.query). The {italic.bold run} (using mssql.Request.batch) or 
        {italic.bold sqlcmd} CLI commands can execute scripts that include 'GO' separated batches.`))
      } else {
        try {
          let ok = true
          if (config.cli.checkSyntax) {
            ok = await sqldb.isSQL(tSQL, target)
          }
          if (ok) {
            let request = new mssql.Request(pool).query(tSQL)
            resolve(await request)
          } else {
            reject(new Error(chalk`(query) invalid TSQL, execution is prempted, try {bold.italic batch edit} or {bold.italic batch reset}`))
          }
        }
        catch(err) {
          errorhandler(err)
          reject(new Error(`(query) failed while executing - note: config.cli.checkSyntax is ${config.cli.checkSyntax}`))
        }
      }
    })
  
  }

}

module.exports = sqldb