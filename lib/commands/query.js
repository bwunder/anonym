//// NPM
const chalk = require('chalk')
//// CORE
const path = require('path')
//// LOCAL
const { archiveQueries, batch, compile, choose, editText, input, spawnTask } = require('../api')
const { log } = require('../log')
const { templates } = require('../store')
const { dft } = require('../viewer')

const config = require('../../config/config.json')

module.exports = {
  description: chalk`CLI query store\n
  Personal, Private, Persistent, NEDB document database store of reusable TSQL 
  queries. Good practice to {bold archive} the store, as a local backup, prior 
  to any {bold edit}, {bold import} or {bold put} actions. Also best to {bold.inverse repo commit} any 
  changes in './lib/queries.js' to the local git before a {bold sync}`,
  args: {
    action: {
      archive: `Archive all queries from the store into a user specified file (other than queries.js)`,
      delete:  `Remove a query from the query cache`,
      develop: `Open './lib/queries.js' for edit in the configured IDE ({italic config.ide}: ${config.ide})`, 
      edit:    `Edit the persistent stored query (for one-off changes, load ({bold.inverse query [load]}) then edit the batch ({bold.inverse batch edit})`, 
      get:     `Display a query from the store (not loaded, simply output to screen for viewing)`,
      import:  `Load all queries from './lib/queries.js' into the CLI query store ({bold opposite of sync})`,
      load:    `${dft()} Load a query from the nedb to the Batch cache for submission`,
      put:     `Add the query now in the Batch cache into the CLI's query store`,
      sync:    `Overwrite './lib/queries.js' with all CLI queries now in nedb store (opposite of {bold import})`   
    },
    filter: ''
  },
  dispatch: async args => {
    let queryName, suggestedName
    let available = await templates.names(args.filter)
    if (!available || available.length===0) {
      templates.import()
    }
    switch(args.action) {
      case ('archive'):
        suggestedName = path.resolve(config.cli.scripts.path, `query_store_archive_${(new Date()).toISOString()}`)
        await archiveQueries(await input('Target file for queries collection archive', suggestedName))
        break
      case ('delete'):
        queryName = await choose(await templates.names(args.filter), 'Query to delete')
        templates.remove(queryName)
        break
      case ('develop'):
         spawnTask(`${config.ide} ${path.resolve(`./lib/queries.js`)}`) 
         break
      case ('edit'):
        queryName = await choose(await templates.names(args.filter), 'Query to edit')      
        templates.upsert(queryName, await editText(await templates.get(queryName)))
        break
      case ('get'): // can use to refer back to existing while composing - does not touch Batch
        queryName = await choose(await templates.names(args.filter), 'query to show')
        log('log', await templates.get(queryName))
        break
      case ('import'):
        templates.import()
        log('log', 'query store is now overwritten with definitions from queries.js')
        break
      case ('put'):
        templates.put(await input('Name for Query in Store'), compile())
        break
      case ('sync'):
        await archiveQueries(path.resolve('lib/queries.js'))
        log('log', 'query store has overwritten queries.js')
        break
      case ('load'): 
      default:
        queryName = await choose(await templates.names(args.filter), 'query to load into the Batch', suggestedName)
        if (!queryName) batch.push(await templates.get(queryName).split('\n'))
        break
    }
  }
}  
