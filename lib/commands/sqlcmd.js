//// NPM
const chalk = require('chalk')
//// CORE
const path = require('path')
//// LOCAL
const { batch, compile, input, secret, writeResults } = require('../api')
const { chooseInstanceId, cmdAttached, isHost } = require('../catalog')
const { dft } = require('../viewer')

const config = require('../../config/config.json')

module.exports = {
  description: chalk`Execute the Batch or a TSQL script via SQLCMD (ODBC) 
  Uses the 'mssql-tools' included with the SQL Server inside an 'official' SQL Container`,
  args: {
    action: {
      exec:     `Submit the query now in the Batch cache`,
      flags:    `SQLCMD's command-line switches`,
      input:    `Select a query or script input file`, 
      session:  `Submit the query now in the Batch cache and remain in the SQLCMD session`,
      spexec:   `Submit the query now in the Batch cache wrapped in sp_executesql()`, 
      usage:    `${dft()} echo the sqlcmd command-line usage message`
    },  
    option: { 
      output: 'Save output to a file in staging folder'
    }
  },
  dispatch: async args => {
    if (await isHost()) {
      let containerId = await chooseInstanceId('up')
      if (containerId) {
        let cmdArgs = [] // populated from config.sqlcmd
        let sqlArg = ''  
        let tsql = `"${compile(config.sqlcmd.prebatch)}\nGO\n${compile(config.sqlcmd.prefix)}\n${compile()}"`
        switch(args.action) {
        case ('spexec'): 
          sqlArg=`-Q` 
          tsql= `${compile(config.sqlcmd.prebatch)}\nGO\n"${compile(config.sqlcmd.prefix)} exec sp_executesq('${compile()}')"`
          break
        case ('input'):
           // choose a file from staging
          sqlArg=`-i "${path.resolve(config.docker.bindings.staging.mount.Target)}`
          break
        case ('exec'):
          sqlArg = `-Q` 
          break
        case ('session'):
          sqlArg=`-q`
          break
        case ('usage'):
        default:
          await cmdAttached(containerId, `${path.resolve(config.cli.odbc.path, 'sqlcmd -?')}`)
          break
        }
        if (sqlArg) {
          let cfgUser = config.sqlcmd.switch.U
          config.sqlcmd.switch.U = await input(chalk`{bold SQL Server} user name`, config.sqlcmd.switch.U)
          if (config.sqlcmd.switch.U!==cfgUser || !config.sqlcmd.switch.P) {
            config.sqlcmd.switch.P = await secret(chalk`{bold SQL Server} user password`)
          } 
          config.sqlcmd.switch.d = config.cli.connectionPool.database
          Object.keys(config.sqlcmd.switch).forEach( key => {
            cmdArgs.push(`-${key}`)
            if (config.sqlcmd.switch[key]!==key) {
              cmdArgs.push(config.sqlcmd.switch[key])
            }
          })
          let result = await cmdAttached(containerId, `sqlcmd ${cmdArgs.join(' ')} ${sqlArg}`.concat(tsql))
          batch.splice(0)
          if (args.options.output) {
            let suggestedName = path.resolve(config.cli.scripts.path, `outfile_${(new Date()).toISOString()}`)            
            writeResults(await input('Host file where output is to be stored', suggestedName), result) 
          }
        }
      }
    }
  }
}  
