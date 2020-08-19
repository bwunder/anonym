//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
// destructure of api.batch causes conflict with export object name
const api = require('../api')
const { isHost, sql } = require('../catalog')
const { log } = require('../log')
const { dft } = require('../viewer')

const config = require('../../config/config.json')

module.exports = batch = {
  description: chalk`Current query buffer cache\n
  Never queries SQL Server database or changes SQL Server data. 
  Enter a {yellowBright Terminating} command to submit the cache for execution. 
     {bold.inverse go}  {bold.inverse run}  {bold.inverse stream}  {bold.inverse sqlcmd}`,
  args: {
    action: {
      edit:   chalk`open and edit the cached query with {bold ${config.editor}}`,
      issql:  chalk`send the cached query to the Target instance to verify as TSQL {bold SET NOEXEC ON}`,
      reset:  chalk`clear the cache of all text (e.g. {bold batch.splice(0)})`,
      sqlcmd: chalk`display the cached query and sqlcmd switches as if submitted via sqlcmd {bold ODBC}`,
      tds:    chalk`${dft()} display the cached query as if submitted via mssql {bold TDS}` 
    }
  },
  dispatch: async args => {
    switch(args.action) {
    case ('edit'):
      api.batch = (await editText(api.compile())).split('\n')
      break
    case ('issql'):
      if (api.batch.join().length>0) {
        if (await isHost()) {
          if (await isSQL(api.compile(), sql.Instance)) {
            log('confirm', chalk`TSQL is valid according to ${sql.Instance}`)
          }
        }
      }
      break
    case ('reset'):
      api.batch.splice(0)
      log('log', 'batch is reset')
      break
    case ('sqlcmd'):
      // prebatch
      log('log', chalk`${config.cli.odbc.path}/sqlcmd
            ${api.compile(config.sqlcmd.switch)} 
            {bold -[i|q|Q]} "${api.compile(config.sqlcmd.prefix)} \n${api.compile()}"`)
      break
    case ('tds'):
    default:
      log('log', api.batch.join().length>0?api.compile():'nothing in cache')
      break
    }
  }
}  