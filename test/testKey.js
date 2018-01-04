const nedb = require('nedb')
const path = require('path')
const config = require('./config');
//const api = require('./api');

// vantage CLI event (user input)
//{"line":{"data":"config -m list","event":"client_prompt_submit"},"timestamp":1509452891781,"_id":"PeCzovfvsDJum3QG"}
const keys = new nedb({
  filename: path.resolve(config.storeFolder, 'keys.db'),
  inMemoryOnly: false, // false is default, true would solve an unbounded file growth issue
  timestampData: true, // stored as "createdAt": {"$$date": valueOf-nbr} not sure how to query by?
  autoload: true,
  onload: (err) =>{
      if (err) {
        console.log('warn', `error loading ${config.storeFolder}/keys.db`)
        console.log('error', err.message)
        console.log('debug', err.stack)
      }
    }
  })

store = {
  keys: {

    get: (query={}, projection={}, sort={createdAt: -1}) => {

      console.log('debug', `query       ${JSON.stringify(query)}`)
      console.log('debug', `projection  ${JSON.stringify(projection)})`
      console.log('debug', `sort        ${JSON.stringify(sort)}`)
      keys.findOne(query, projection).sort(sort).exec(function(err, doc) {
        if (err) throw err
        if (!doc) {
          console.log('warn', `no keys logged`.blue)
        } else {
          console.log('debug', `[store.keys.findOne]`.blue)
          console.log('debug', doc)
        }
      })

    },
    put: (command, event) => {

      console.log('debug', 'put')
      console.log('debug', command)
      console.log('debug', event)
      keys.insert({command, event})

    }

  }
}

store.keys.put('test-command', 'test-event')
store.keys.get()
