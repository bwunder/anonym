////NPM
const nedb = require('nedb')
////core
const path = require('path')
////local
const config = require(`./config.json`)
const api = require(`./api.js`)

// memory-only is implicit of no filename, but to be explicit:
const batch = new nedb({inMemoryOnly: true})

const batches = new nedb({
  filename: path.resolve(config.storeFolder, 'batches.db'),
  timestampData: true,
  autoload: true,
  onload: (err) => {
      if (err) {
        api.log('warn', `(store.batches) error loading ${config.storeFolder}/batches.db`)
        api.log('error', err.message)
        api.log('debug', err.stack)
      }
    }
  })

const commands = new nedb({
  filename: path.resolve(config.storeFolder, 'commands.db'),
  timestampData: true,
  autoload: true,
  onload: (err) =>{
      if (err) {
        api.log('warn', `(store.commands) error loading ${config.storeFolder}/commands.db`)
        api.log('error', err.message)
        api.log('debug', err.stack)
      }
    }
  })

const configs = new nedb({
  filename: path.resolve(config.storeFolder, 'configs.db'),
  timestampData: true,
  autoload: true,
  onload: (err) =>{
      if (err) {
        api.log('warn', `(store.commands) error loading ${config.storeFolder}/commands.db`)
        api.log('error', err.message)
        api.log('debug', err.stack)
      }
    }
  })

const errors = new nedb({
  filename: path.resolve(config.storeFolder, 'errors.db'),
  timestampData: true,
  autoload: true,
  onload: (err) =>{
      if (err) {
        api.log('warn', `(store.errors) error loading ${config.storeFolder}/errors.db`)
        api.log('error', err.message)
        api.log('debug', err.stack)
      }
    }
  })

// readline
const lines = new nedb({
  filename: path.resolve(config.storeFolder, 'lines.db'),
  inMemoryOnly: false, // false is default
  timestampData: true, // stored as "createdAt": {"$$date": valueOf-nbr} not sure how to query by?
  autoload: true,
  onload: (err) =>{
      if (err) {
        api.log('warn', `(store.lines) error loading ${config.storeFolder}/lines.db`)
        api.log('error', err.message)
        api.log('debug', err.stack)
      }
    }
  })

  lines.ensureIndex({ fieldName: 'createdAt'}, function (err) {
    if (err) {
      api.log('warn', `(store.lines.ensureIndex) error`)
      api.log('error', err.message)
      api.log('debug', err.stack)
    }
  });

  // docker pulls
  const pulls = new nedb({
    filename: path.resolve(config.storeFolder, 'pulls.db'),
    inMemoryOnly: false, // false is default
    timestampData: true, // false is default adds createAt updatatedAt fields
    autoload: true, // false is default -- no need to call loadDatabase if true
    onload: (err) =>{
      if (err) {
        api.log('warn', `(store.pulls) error loading ${config.storeFolder}/pulls.db`)
        api.log('error', err)
      }
    },
    afterSerialization: (data) => {
      // encrypt stream into pulls.db file here - but this looks like it fires for every character (bit?) of unknown stream
      // api.log('debug', `(pull.afterSerialization) data:\n ${data}`)
      return data
    },
    beforeDeserialization: (data) => {
      // api.log('debug', `(pull.beforeDeserialization) data:\n ${data}`)
      return data
    },
    corruptAlertThreshold: 0, //0.00-1.00 (pct) allowed, default is .10
    compareStrings: `localCompare` // localCompare is default
  });

  // mostly static collection of oft used queries
  const templates = new nedb({
    filename: path.resolve(config.storeFolder, 'templates.db'),
    inMemoryOnly: false, // false is default
    timestampData: true, // false is default {{data by key...}, createAt:date, updatedAt:date}
    autoload: true, // false is default -- no need to call loadDatabase if true
    onload: (err) =>{
      if (err) {
        api.log('warn', `(store.templates) error loading ${config.storeFolder}/templates.db`)
        api.log('error', err)
      }
    },
    corruptAlertThreshold: 0, //0.00-1.00 pct allowed, default is .10
    compareStrings: `localCompare` // localCompare is default
  });

module.exports = exports = store = {

  // batch: { // an associative array of lines {index: line}
  //
  //   get: (index) => {
  //
  //     batch[index]
  //
  //   },
  //   getSQL: () => { // return an array of lines
  //
  //     return str
  //
  //   },
  //   insert: (script) => {
  //
  //   },
  //   put: (line) => {
  //     batch[Object.keys(batch).length+1]=line
  //   },
  //   delete: () => {
  //     batch
  //   }
  //
  // },
  batches: {

    get: (timestamp=new Date()) => {

      return new Promise( (resolve, reject) => {
        batches.findOne({ createdAt : { $lte: timestamp } }, {_id: 0, batch: 1}).exec(function(err, doc) {
          if (err) reject(err)
          if (!doc) {
            api.log('warn', `(store.batches.get) no batches before ${timestamp}`)
          } else {
            api.log('debug', `(store.batches.get)`)
            api.log('debug', doc)
          }
          return resolve(doc)
        })
      })

    },
    list: (query={}, projection={}, sort={createdAt: -1}, limit=0) => {

      return new Promise( (resolve, reject) => {
        batches.find(query, projection).sort(sort).limit(limit).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })

    },
    put: (batch, rowsAffected) => {

      batches.insert({batch, rowsAffected})

    }

  },
  errors: {

    getLast: function(query={}) {

      return new Promise( (resolve, reject) => {
        commands.find(query, {_id: 0, batch: 1}).sort({createdAt: -1}).limit(1).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })

    },
    list: function(query={}, projection={}, sort={createdAt: -1}, limit=0) {

      return new Promise( (resolve, reject) => {
        errors.find(query, projection).sort(sort).limit(limit).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })

    },
    put: (error) => {

      errors.insert({error})

    }

  },
  commands: {

    get: function(query={}) {

      return new Promise( (resolve, reject) => {
        commands.find(query, {_id: 0, batch: 1}).sort({createdAt: -1}).limit(1).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })

    },
    list: function(query={}, projection={}, sort={createdAt: -1}, limit=0) {

      return new Promise( (resolve, reject) => {
        commands.find(query, projection).sort(sort).limit(limit).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })

    },
    put: (command) => {

      commands.insert({command})

    }

  },
  configs: {

    get: function(containerId) {

      return new Promise( (resolve, reject) => {
        configs.findOne({_id: containerId}).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })

    },
    getLastInstanceId: async () => {

      return new Promise( (resolve, reject) => {
        configs.findOne({}).sort({updatedAt: -1}).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(!doc? api.sqlCatalog.Instance: doc._id)
        })
      })

    },
    list: function(query={}, projection={}, sort={updatedAt: -1}, limit=0) {

      return new Promise( (resolve, reject) => {
        configs.find(query, projection).sort(sort).limit(limit).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })

    },
    put: () => {

      configs.insert({config: config.mssql, _id: api.sqlCatalog.Instance})

    },
    update: (upsert=true) => {

      let mssql = config.mssql
      let containerId=api.sqlCatalog.Instance
      configs.update({_id: containerId}, {_id: containerId, mssql: config.mssql}, { upsert: upsert })

    }
  },
  lines: {

    get: function(query={}) {

      return new Promise( (resolve, reject) => {
        lines.find(query).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc[0])
        })
      })

    },
    getLast: function(query={}) {

      return new Promise( (resolve, reject) => {
        lines.find(query).sort({createdAt: -1}).limit(1).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc[0])
        })
      })

    },
    list: function(query={}, projection={}, sort={updatedAt: -1}, limit=0) {

      return new Promise( (resolve, reject) => {
        lines.find(query, projection).sort(sort).limit(limit).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })

    },
    put: (line) => {

      lines.insert({line})

    }

  },
  queries: {

    get: async (queryName) => {

      return new Promise( function(resolve, reject) {
        api.log('debug', `(store.queries.get) - get ${queryName}`)
        templates.findOne({name: queryName}, {_id: 0, template: 1}).exec(function(err, doc) {
          if (err) throw err
          if (!doc) {
            api.log('warn', `(store.queries.get) query not found`)
          } else {
            return resolve(doc.template)
          }
        })
      })

    },
    getBatch: (queryName) => {

      new Promise(function(resolve, reject) {
        api.log('debug', `(store.queries.getBatch) loading query text '${queryName}' from query store into cache`)
        templates.findOne({name: queryName}, {_id: 0, template: 1}).exec( function(err, doc) {
          if (err) {
            api.log('error', err)
          } else {
            if (!doc) {
              api.log('warn', `(store.queries.getBatch) query '${queryName}' not found`)
            } else {
              api.log('debug', `(store.queries.getBatch)`)
              api.log('debug', doc)
              api.batch = [`-- ${queryName}`].concat(doc.template.split('\n'))
              resolve(api.log('debug', api.batch))
            }
          }
        })
      })

    },
    import: () => {

      templates.count({}).exec(function(err, nbr) {
        if (err) {
          api.log('error', err);
        } else {
          if (!nbr) {
            api.log('log', '(store.queries.import) queries.js template strings into templates.db')
            const queriesjs = require('./queries.js')
            Object.keys(queriesjs).forEach((name) => {
              api.log('log', `(store.queries.getBatch) upsert query ${ name }\n${ queriesjs[name] }\n`)
              templates.update( { name: name }, { $set: { text: queriesjs[name] } }, { upsert: true })
            })
          }
        }
      })

    },
    put: (queryName, query) => {

      templates.update( { name: queryName }, { $set: { text: query } }, { upsert: true })
      //templates.insert({ name: queryName, text: query })

    },
    list: function(query={}, projection={_id: 0, name: 1, text: 1 }, sort={updatedAt: -1}, limit=0) {

      return new Promise( (resolve, reject) => {
        templates.find(query, projection).sort(sort).limit(limit).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })

    },
    names: () => {

      return new Promise(function(resolve, reject) {
        try{
          templates.find({}, {_id: 0, name: 1 }).sort().exec(function(err, docs) {
            let list=[]
            if (err) throw err
            docs.forEach((doc) => {
            if (typeof doc=='undefined') api.log('log', doc)
              list.push(doc.name)
            })
            resolve(list)
          })
        }
        catch (err) {
          reject(err)
        }
      })

    },
    remove: (queryName) => {

      templates.remove({ name: queryName})

    },
    search: (textToFind) => {

      api.log('debug', `(store.queries.search) find query(s) containing ${textToFind}`)
      templates.find({textToFind: {$IN: text}}).sort({}).exec(function(err, docs) {
        return docs
      })

    },
    update: (queryName, text) => {

      // Set an existing field's value
      templates.update({name: queryName}, {$set: {template: text}}, {multi: false, upsert: false}, function (err, result) {
        if (err) {
          api.log('warn', `(store.queries.search) error`)
          api.log('error', err)
        } else {
          api.log('debug', `(store.queries.search) ${queryName} updated`)
        }
      })

    },
    upsert: (queryName, text) => {

      templates.update({name: queryName}, {$set: {template: text}}, {multi: false, upsert: true}, function (err, result) {
        if (err) {
          api.log('warn', `(store.queries.upsert) error`)
          api.log('error', err)
        } else {
          api.log('debug', `(store.queries.upsert) ${queryName} updated:\n${result}`)
        }
      })

    }

  }, // end queries
  pulls: {

    // the pull then in effect? not so sure the new Date will work...
    get: ( datetimestamp = new Date() ) => {
      let query = { createdAt: { $lte: datetimestamp } }
      let projection = {}
      api.log('debug', `(store.pulls.get) get ${api.format(_id)} projection ${api.format(projection)}`)
      pulls.findOne(query, projection ).exec(function(err, doc) {
        if (err) throw err
        if (!doc) {
          api.log('warn', `(store.pulls.get) no pull on or before ${datetimestamp}`)
        } else {
          api.log('debug', `(store.pulls.get)`)
          api.log('debug', doc)
          return doc
        }
      })

    },
    list: function(query={}, projection={}, sort={updatedAt: -1}, limit=0) {

      return new Promise( (resolve, reject) => {
        pulls.find(query, projection).sort(sort).limit(limit).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })


    },
    put: (output) => {

      pulls.insert({output})

    }

  }

}
