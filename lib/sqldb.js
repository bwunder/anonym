////NPM
const chalk = require('chalk')
const mssql = require('mssql')
////CORE
const { inspect } = require('util')
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
        log('log', chalk`{red \u2A1D}  SQL Server error 
          Number:  ${err.number} 
          Class:   ${err.class} 
          State:   ${err.state} 
          Line:    ${err.lineNumber}
          Message: ${err.message}\n`)
        break  
      case (typeof err.code!=='undefined'): // OS
        log('log', chalk`{red \u274E}  OS error, code ${err.code}
          ${constants.err?constants.err.nbr[err.code]:inspect(err)}\n`)
        break
      default:
        log('log', chalk`{red \u274E}  error\n${inspect(err)}\n`)
        break  
      }    
  }
  catch(e) {
    process.stderr.write(chalk`{red \u274E} errorhandler error\n{red ${e.message}}\n`)
    //try write orig error to stdout 
    switch(true) {
      case (typeof err.class!=='undefined'): // query 
        process.stderr.write(chalk`{red \u21AD}  SQL Server error 
          Nbr:   ${err.number} 
          Class: ${err.class} 
          State: ${err.state} 
          Line:  ${err.lineNumber}
          Msg:   ${err.message}\n`)
        break  
      case (typeof err.code!=='undefined'): // OS
        process.stderr.write(chalk`{red \u274E}  OS error, code ${err.code}
          ${constants.err?constants.err.nbr[err.code]:inspect(err)}\n`)
        break
      default:
        process.stderr.write(chalk`{red \u274E}  error\n${inspect(err)}\n`)
        break  
      }
  }
  return
}

const sqldb = {

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
            //reject(new Error(chalk`(query) invalid TSQL, execution is prempted, try {bold.italic batch edit} or {bold.italic batch reset}`))
            reject(errorhandler(new Error(`(query) ${tsql}`)))
          }
        }
        catch(err) {
          reject(errorhandler(err))
        }
      }
    })
  
  },
  isSQL: (tSQL, sqlserver) => {

    return new Promise( async (resolve, reject) => {
      try {
        if (typeof tSQL==='undefined' || /NOEXEC/i.test(tSQL)) resolve(false)
        let batch
        let request=new mssql.Request(openPools[sqlserver])
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
  openPool: async (containerId, options) => {
    // Classic Connection Strings  
    // Server=localhost,1433;Database=database;User Id=username;Password=password;Encrypt=true
    // Driver=msnodesqlv8;Server=(local)\INSTANCE;Database=database;UID=DOMAIN\username;PWD=password;Encrypt=true
    // Connection URI
    // mssql://username:password@localhost:1433/database?encrypt=true
    // mssql://username:password@localhost/INSTANCE/database?encrypt=true&domain=DOMAIN&driver=msnodesqlv8
    // Connnection Pool Options Object 
    //   {"connectionTimeout":15000,"options":{"encrypt":false},"parseJSON":true,
    //    "pool":{"closeTimeoutMillis":30000,"idleTimeoutMillis":30000,"max":10,"min":0},
    //    "requestTimeout":15000,"server":"localhost","stream":false,"user":"sa","port":44319,
    //    "password":"YourStrong!Passw0rd"}
    return new Promise( async (resolve, reject) => {
      try {
        // one active cli pool per instance
        if (openPools[containerId.id]) openPools[containerId.id].close() 
        openPools[containerId] = new mssql.ConnectionPool(options) 
        openPools[containerId].on('error', (err) => {
          process.stderr.write(chalk`{rgb(255, 136, 0) \u2A1D}  {red ${err.originalError.code}}: ${err.originalError.message}`)
          errorhandler(err)
        })
        await openPools[containerId].connect()
        let request = new mssql.Request(openPools[containerId])
        let result = await request.query(`select db_name() as [database], SERVERPROPERTY('ServerName') AS [server]`)
        if (options.database && options.database!==result.recordset[0].database) {
          errorhandler(new Error(`Failed to open Database '${config.mssql.pool.database}', using '${result.recordset[0].database}'`))
        }  
        log('log', chalk`{rgb(255, 136, 0) \u2A1D}  Pool open: db ${result.recordset[0].database} in sql container ${result.recordset[0].server}\n`)
        resolve(config.mssql.pool.database = result.recordset[0].database)
      }
      catch(connectionError) {
        return reject(errorhandler(connectionError))
      }
    })  

  },
  run: async (tsql, sqlserver) => {

    return new Promise( async (resolve, reject) => {
      let batch
      let ok = true
      let results = []
      let request = new mssql.Request(openPools[sqlserver])
      //request.multiple=true // the default i suspect for guery and batch - result object always has placeholder
      if (config.cli.checkSyntax) {
        ok = await sqldb.isSQL(tsql, sqlserver) // first failing batch
      }
      if (ok) {
        for (batch of tsql.split(/\nGO\n/i)) {
          try {
            results.push(await request.batch(batch))
          }
          catch(err) {
            reject(errorhandler(new Error(`(batch)\n${batch}\n${err}`)))
          }
          return resolve(results)
        } 
      } else {
        reject(errorhandler(new Error(`(batch) Did not validate, execution is pre-empted`)))
      }  
    })

  },
  stream: async (tSQL, sqlserver, rowListener) => {

    // output object og {"columnName": "widths"}
    return new Promise( async (resolve, reject) => {
      try {
        let count=0
        let counts=[]
        let keys=[]
        let request
        if (Object.keys(openPools).includes(sqlserver)) {
          request = new mssql.Request(openPools[sqlserver])
        } else { 
          request = new mssql.Request(await store.pools.get(sqlserver))  
        }
        request.stream = true
        
        request.on('recordset', columns => {
          if (count!==0) counts.push(count) // if MARS
          count=0 // ready for next  
          keys=Object.keys(columns)
          // get max actual data length for each 
          for (let colname of keys) { 
            if (columns[colname].length < columns[colname].name.length) columns[colname].length = colname.length
          }
          log('log', chalk`{rgb(255, 136, 0) \u2A1D}  columns\n  ${format(columns)}`)
        })

        request.on('row', row => {
          count+=1
          let line = (config.cli.numberStreamedLines? `${count}`: ``).padEnd(4)
          if (!rowListener) {
            for (let col of keys) {
              if (typeof cols[col].length==='undefined') cols[col].length=`${('' + row[col]).length}` 
              if (row[col].length > cols[col].length) cols[col].length = row[col].length              
              if (keys.indexOf(col)===keys.length-1) {
                line+=(typeof row[col]==='string')? row[col].trim(): row[col]
              } else {
                line+=`${row[col]}`.padEnd(cols[col].length)
              }
            }
            log('log', line)
          } else {
            // row scoped javascript function - o'wise we attempt our 'tabular' dump to stdout
            rowListener(row)
          }
        })

        request.on('error', err => {
          reject(errorhandler(new Error(`(stream) error\n${err}`)))
        })        

        request.on('done', result => {
          resolve(log('log', chalk`{rgb(255, 136, 0) \u2A1D}  ${format(result)}`))
        })

        request.query(tSQL) 
      }
      catch(err) {
        reject(errorhandler(err))
      }
    })

  }

}

module.exports = sqldb