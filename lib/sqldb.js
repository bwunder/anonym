////NPM
const chalk = require('chalk')
const mssql = require('mssql')
////CORE
const { constants } = require('os')
////LOCAL
const { format, log } = require('../lib/log')
const { pools } = require('../lib/store')

const config = require('../config/config.json')

let openPools={}

const errorhandler = err => {
  try {
    switch(true) {
      case (typeof err.class!=='undefined'): // query 
        log('error', chalk`{redBright (sqldb) SQL Server error} 
          Number:  ${err.number} 
          Class:   ${err.class} 
          State:   ${err.state} 
          Line:    ${err.lineNumber}
          Message: ${err.message}\n`)
        break  
      case (typeof err.code!=='undefined'): // OS
        log('error', chalk`{redBright (sqldb) OS error}, error code ${err.code}
          ${constants.err?constants.err.nbr[err.code]:format(err)}\n`)
        break
      default:
        log('error', chalk`{redBright (sqldb) error}\n${format(err)}\n`)
        break  
      }    
  }
  catch(e) {
    // error in handler 
    process.stderr.write(chalk`{redBright (sqldb) errorhandler failure}\n${e.message}\n`)
    process.stderr.write(err)
  }
  return
}

module.exports = sqldb = {
  go: async (tsql, sqlserver) => {
    return new Promise( async (resolve, reject) => {
      if (/\nGO\n/i.test(tsql) || /\nUSE\n/i.test(tsql)) {
        return reject(new Error(chalk`The 'GO' batch terminator is not permitted when submitted 
        with the {italic.bold go} CLI command (uses mssql.Request.query). The {italic.bold run} (using mssql.Request.batch) or 
        {italic.bold sqlcmd} CLI commands are able to execute scripts that may include 'GO' separated batches.`))
      } else {
        try {
          let ok = true
          if (config.cli.checkSyntax) {
            ok = await sqldb.isSQL(tsql, sqlserver)
          }
          if (ok) {
            let request = new mssql.Request(openPools[sqlserver]).query(tsql)
            resolve(await request)
          } else {
            throw(new Error(`(query-syntax) ${tsql}`))
          }
        }
        catch(err) {
          reject(errorhandler(new Error(`(query-try) ${tsql}`)))
        }
      }
    })  
  },
  isSQL: (tSQL, sqlserver) => {
    return new Promise( async (resolve, reject) => {
      let batch
      try {
        if (typeof tSQL==='undefined' || /NOEXEC/i.test(tSQL)) resolve(false)
        let request=new mssql.Request(openPools[sqlserver])
        request.multiple=true
        try {
          for (batch of tSQL.split(/\nGO\n/i)) {
            if (batch.trimRight().endsWith('\nGO')) {
              batch = batch.trimRight().substring(0, batch.trimRight().length-3)
            }
            await request.batch(`SET NOEXEC ON;\n${batch};\nSET NOEXEC OFF;`)
          }
          resolve(true)
        }  
        catch(err) {
          if (err.code && err.code==='ECONNCLOSED') { 
            reject(err)           
          } else {
            if (batch!==tSQL) {
              errorhandler(new Error(`(isSQL) Validation failed for batch\n${batch || 'no data'}`))
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
  openPool: async (containerId, options, name) => {
    return new Promise( async (resolve, reject) => {
      try {
        if (config.mssql.pool.options.encrypt) {
//TODO & needs creds - (pass in options? or ?)
        }
        // limit to one active pool from CLI per instance
        while (openPools[containerId]) {
          openPools[containerId].close()
          openPools[containerId] = undefined 
        }  
        openPools[containerId] = new mssql.ConnectionPool(options) 
        openPools[containerId].on('error', (err) => {
          errorhandler(err)
        })
        await openPools[containerId].connect()
        let request = new mssql.Request(openPools[containerId])
        let result = await request.query(`select DB_NAME() AS [database], SERVERPROPERTY('ServerName') AS [server]`)
        if (options.database && options.database!==result.recordset[0].database) {
          options.database = result.recordset[0].database
          errorhandler(new Error(`Failed to open Database {bold ${config.mssql.pool.database}}, using {bold ${options.database}}`))
        }  
        log('sqldb', chalk`Pool open in db: {bold ${options.database}}, instance: {bold ${containerId}}, name: {bold ${name}}\n`)
        resolve(result.recordset[0].database)
      }
      catch(connectionError) {
        reject(errorhandler(connectionError))
      }
    }) 
  },
  readLog: (containerId, options) => {
    return new Promise( async (resolve, reject) => {
      if (openPools[containerId]) {
        let zargs = `${options.extention||0}, ${options.agent? 2: 1}`
          .concat(`, `.concat(options.find1? `N'${options.find1}'`: `NULL`))
          .concat(`, `.concat(options.find2? `N'${options.find2}'`: `NULL`))
          .concat(`, `.concat(options.begin? `'${options.begin}'`: `NULL`))
          .concat(`, `.concat(options.until? `'${options.until}'`: `NULL`))
          .concat(`, `.concat(options.descending? `N'DESC'`: `N'ASC'`))
        return sqldb.go(`EXEC sys.xp_readerrorlog ${zargs}`, containerId)
        .then( results => {
          let i = 0
          while (i<results.rowsAffected) {
            log('sqldb', chalk`{magentaBright ${results.recordset[i].LogDate}}  {cyanBright ${results.recordset[i].ProcessInfo}}  ${results.recordset[i].Text}`)
            i+=1
          }
          resolve()
        })
        .catch( err => {
          reject(errorhandler(new Error(`(readLog) xp_readerrorlog failed\n${err.message}`)))
        })
      }
    })
  },
  run: async (tsql, sqlserver) => {
    return new Promise( async (resolve, reject) => {
      let batch
      let ok = true
      let results = []
      let request = new mssql.Request(openPools[sqlserver])
      if (config.cli.checkSyntax) {
        ok = await sqldb.isSQL(tsql, sqlserver) // first failing batch
      }
      if (ok) {
        for (batch of tsql.split(/\nGO\n/i)) {
          try {
            results.push(await request.batch(batch))
          }
          catch(err) {
            reject(errorhandler(new Error(`(run)\n${batch}\n${err}`)))
          }
          return resolve(results)
        } 
      } else {
        reject(errorhandler(new Error(`(run) Did not validate, execution is pre-empted`)))
      }  
    })
  },
  stream: async (tSQL, sqlserver, rowListener) => {
    return new Promise( async (resolve, reject) => {
      try {
        let count=0
        let counts=[]
        let keys=[]
        let request
        if (Object.keys(openPools).includes(sqlserver)) {
          request = new mssql.Request(openPools[sqlserver])
        } else { 
          request = new mssql.Request(await pools.get(sqlserver))  
        }
        request.stream = true        
        request.on('recordset', columns => {
          if (count!==0) counts.push(count) // MARS
          count=0 
          keys=Object.keys(columns)
          for (let colname of keys) { 
            if (columns[colname].length < columns[colname].name.length) columns[colname].length = colname.length
          }
        })
        request.on('row', row => {
          count+=1
          let line = (config.cli.numberStreamedLines? `${count}`: ``).padEnd(4)
          if (!rowListener) {
            for (let col of Object.keys(row)) {
                line+=(typeof row[col]==='string')? row[col].trim(): row[col]
            }
            log('sqldb', line)
          } else {
            // row scoped javascript function - o'wise we attempt our 'tabular' dump to stdout
            rowListener(row)
          }
        })
        request.on('error', err => {
          reject(errorhandler(new Error(`(stream) error\n${err}`)))
        })        
        request.on('done', result => {
          resolve(log('sqldb', format(result)))
        })
        request.query(tSQL) 
      }
      catch(err) {
        reject(errorhandler(err))
      }
    })
  }
}

