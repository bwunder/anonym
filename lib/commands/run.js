//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { isHost } = require('../catalog')
const { log } = require('../log')

const config = require('../../config/config.json')
const { tunes } = require('../store')

module.exports = {
  description: chalk`Execute the Batch on the Target using mssql.Request.batch()
  While this method will run any valid query, it is well suited for query
  tuning with showplan and SQL Server supplied runtime statistics. 
  
  Either option transiently wraps SET Statements around the compiled cache:

    {bold SET SHOWPLAN_ALL|TEXT|XML ON}
    GO
    -the compiled tsql from the batch cache-
    GO
    {bold SET SHOWPLAN_ALL|TEXT|XML OFF} 

  or 

    {bold SET STATISTICS IO|PROFILE|XML ON/OFF} 
    GO
    -the compiled tsql from the batch cache-
    GO
    {bold SET STATISTICS IO|PROFILE|XML ON/OFF} 

  Use archived showplans and statistics output along with the DMVs for testing,
  research, troubleshooting, baselines & comparisons. The batch from archive, 
  and when helpful even the user lines used to build the batch, should later be 
  match-able to the collection of tune results by datetime (<=createdAT).`,
  args: {
    tune: { 
      showplan:  chalk`[{underline A}LL|{underline T}EXT|{underline X}ML]`,
      statistics: chalk`[{underline I}O|{underline P}ROFILE|{underline T}IME|{underline X}ML]`
    }
  },
  dispatch: async args => {
    try {
      let stmt
      if (await isHost()) {
        switch (true) {
        case (/^al*l*$/i.test(args.options.showplan)):
          stmt='SHOWPLAN_ALL'
          break
        case (/^te*x*t*$/i.test(args.options.showplan)):
          stmt='SHOWPLAN_TEXT'
          break
        case (/^xm*l*$/i.test(args.options.showplan)):
          stmt='SHOWPLAN_XML'
          break
        case (/^io*$/i.test(args.options.statistics)):
          stmt=`STATISTICS IO`
          break
        case (/^pr*o*f*i*l*e*$/i.test(args.options.statistics)):
          stmt=`STATISTICS PROFILE`
          break
        case (/^ti*m*e*$/i.test(args.options.statistics)):
          stmt=`STATISTICS TIME`
          break
        case (/^xm*l*$/i.test(args.options.statistics)):
          stmt=`STATISTICS XML`
          break
        default:
          break
        }
        const tsql = compile()
        if (stmt) {
          tsql = `SET ${stmt} ON\nGO\n${tsql}\nGO\nSET ${stmt} OFF`
        }
        const results = await run(tsql, catalog.sql.Instance)
        // timestamp of batch archive should be last b4 this tunes put,
        if (stmt) tunes.put(results)
        for (let result of results)
        { 
          if (result.recordsets.length>0) {
            for (let rs of result.recordsets) {
              log('log', rs)
            }
          }  
          else if (result.recordset) log('log', result.recordset)
          else log('info', result)
        }
        batch.splice(0) // !!! this needs to be optional
      }
    }  
    catch (err) {
      log('error', `(run) error\n${format(err)}`)
    }  
  }
}
