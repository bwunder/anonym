//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { batch, compile } = require('../api')
const { chooseInstanceId, choosePoolId, sql } = require('../catalog')
const { format, log } = require('../log')
const { go } = require('../sqldb')
const { dft } = require('../viewer')

module.exports = {
  description:  chalk`Submit the batch cache for execution on the Target SQL Server\n
  {bold.inverse go} is a {yellowBright Terminating} command indicating that the host query cache is 
  compiled and sent to a connected SQL Server, by default the current Target, for 
  execution using this command. And that queries the do not return an error code 
  when executed will be cleared from the batch preparing it for a new input.`,
  args: {
    pool:  `choose any container in catalog`,
    '':    `${dft} Use the current target Instance`
  },
  dispatch: async args => {
    let result
    let query = compile(batch)
    let containerId = (!args || !args.options.pool)? sql.Instance: await choosePoolId() 
    if (sql.Pools.has(containerId)) {    
      result = await go(query.trim(), containerId)
      if (result.recordsets.length>0) {
        for (let rs of result.recordsets) {
          log('log', rs)
        }
      }  
      else if (result.recordset) log('log', result.recordset)
      else log('info', result)
      if (result.rowsAffected[0]>0) log('log', `rowsAffected: ${result.rowsAffected}`)
      batch.splice(0)
    } else {
      await chooseInstanceId()      
    }
  }
}  

