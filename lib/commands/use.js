//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const view = require('../../lib/viewer')

const config = require('../../config/config.json')

module.exports = {
  description: `CLI Database Context - change Target's Connection Pool database
  Changes the database attribute for the CLI's current Connection Pool. The change is pesistent.`,
  args: {},
  dispatch: async args => {
    if (!args.database) {
      log('log', `database: ${(await store.pools.get(catalog.sql.Instance)).pool.database}`)
    } else {
      if (catalog.sql.Pools.has(catalog.sql.Instance)) {
        await catalog.openInstance(catalog.sql.Instance, args.database)
      }  
    }
  }
}
