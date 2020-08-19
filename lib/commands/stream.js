//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { batch, compile } = require('../api')
const { sql } = require('../catalog')
const { log } = require('../log')
const { stream } = require('../sqldb')

const config = require('../../config/config.json')

module.exports = {
  description: `Execute the Batch using mssql.Request.batch() and stream results back`,
  args: {},
  dispatch: async () => {
    try {
      let result
      let query = compile(api.batch)
      if (sql.Pools.has(sql.Instance)) {
        await stream(query.trim(), sql.Instance)
        batch.splice(0)
      } 
    }
    catch (err) {
      log('error', err)
    }
  }
}
