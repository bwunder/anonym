//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { choose, input } = require('../api')
const { log } = require('../log')
const { search } = require('../store')
const view = require('../viewer')

const config = require('../../config/config.json')

module.exports = {
  description: `Query a nedb collection
    The command tries to take the user through query construction and execution`,
  args: {
    option: {}
  },
  dispatch: async () => {
    let isJSON = val => {
      try{
        JSON.parse(val)
        return true
      }
      catch (syntaxError) {
        log('error', syntaxError)
        return false
      }
    }
    try {
      log('info', chalk`Query builder for CLI nedb object store with MongoDB API.
      The {bold find}, {bold projection} and {bold sort} objects must be input as
      well-formed JSON (JSON.stringify(obj)).  
      Use {bold Ctrl}{bold -C} to abort a too-long running CLI command.`)
      let collection = await choose(Object.keys(store), 'Collection')
      let find
      do {
        find = await input(`find - JSON:`, JSON.stringify({}))
      }
      while (!isJSON(find)) 
      let projection
      do {
        projection = await input('projection - JSON:', JSON.stringify({}))
      }
      while (!isJSON(projection)) 
      let sort
      do {
        sort = await input('sort - JSON', JSON.stringify({createdAt: -1}))
      }
      while (!isJSON(sort)) 
      let limit = await input('limit - integer', '8')
      let skip = await input('skip - integer', '0')
      log('log', await search(collection, JSON.parse(find), JSON.parse(projection), JSON.parse(sort), limit, skip))
    }
    catch(err) {
      log('error', err)
    }
  }
}  
