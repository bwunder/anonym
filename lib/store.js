////NPM
const nedb = require('nedb')
////core
const path = require('path')
////local
const config = require(`../config/config.json`)
const api = require(`../lib/api.js`)

// memory-only is implicit of no filename, but to be explicit:
//const batch = new nedb({inMemoryOnly: true})
function genCollection(name, compactMs=0) {
  let newdb = new nedb({
    filename: path.resolve(config.cli.store.path, `${name}.db`),
    timestampData: true,
    inMemoryOnly: false, // false is default
    autoload: true,
    onload: (err) => {
        if (err) {
          api.log('warn', `(genCollection) error loading ${config.cli.store.path}/${name}.db`)
          api.log('error', err.message)
          api.log('debug', err.stack)
        }
      },
    corruptAlertThreshold: 0, //0.00-1.00 (pct) allowed, default (.10) is wrongheaded
  })
  newdb.persistence.setAutocompactionInterval(compactMs)
  return newdb
}

const collections = {

  batches: genCollection('batches'),
  pools: genCollection('pools'),
  errors: genCollection('errors'),
  lines: genCollection('lines'),
  npm: genCollection('npm'),
  pulls: genCollection('pulls'),
  templates: genCollection('templates')
  // batches: new nedb({
  //   filename: path.resolve(config.cli.store.path, 'batches.db'),
  //   timestampData: true,
  //   autoload: true,
  //   onload: (err) => {
  //       if (err) {
  //         api.log('warn', `(store.batches) error loading ${config.cli.store.path}/batches.db`)
  //         api.log('error', err.message)
  //         api.log('debug', err.stack)
  //       }
  //     },
  //   corruptAlertThreshold: 0 //0.00-1.00 (pct) allowed, default (.10) is wrongheaded
  // }),

  // pools: new nedb({
  //   filename: path.resolve(config.cli.store.path, 'pools.db'),
  //   timestampData: true,
  //   autoload: true,
  //   onload: (err) =>{
  //       if (err) {
  //         api.log('warn', `(store.commands) error loading ${config.cli.store.path}/commands.db`)
  //         api.log('error', err.message)
  //         api.log('debug', err.stack)
  //       }
  //     },
  //     corruptAlertThreshold: 0 //0.00-1.00 (pct) allowed, default (.10) is wrongheaded
  // }),

  // errors: new nedb({
  //   filename: path.resolve(config.cli.store.path, 'errors.db'),
  //   timestampData: true,
  //   autoload: true,
  //   onload: (err) =>{
  //       if (err) {
  //         api.log('warn', `(store.errors) error loading ${config.cli.store.path}/errors.db`)
  //         api.log('error', err.message)
  //         api.log('debug', err.stack)
  //       }
  //     },
  //     corruptAlertThreshold: 0 //0.00-1.00 (pct) allowed, default (.10) is wrongheaded
  // }),

  // lines: new nedb({
  //   filename: path.resolve(config.cli.store.path, 'lines.db'),
  //   inMemoryOnly: false, // false is default
  //   timestampData: true, // stored as "createdAt": {"$$date": valueOf-nbr} not sure how to query by?
  //   autoload: true,
  //   onload: (err) =>{
  //       if (err) {
  //         api.log('warn', `(store.lines) error loading ${config.cli.store.path}/lines.db`)
  //         api.log('error', err.message)
  //         api.log('debug', err.stack)
  //       }
  //     },
  //   corruptAlertThreshold: 0 //0.00-1.00 (pct) allowed, default (.10) is wrongheaded
  // }),
  //
  // npm: new nedb({
  //   filename: path.resolve(config.cli.store.path, 'npm.db'),
  //   inMemoryOnly: false, // false is default
  //   timestampData: true, // false is default adds createAt updatatedAt fields
  //   autoload: true, // false is default -- no need to call loadDatabase if true
  //   onload: (err) =>{
  //     if (err) {
  //       api.log('warn', `(store.npm) error loading ${config.cli.store.path}/npm.db`)
  //       api.log('error', err)
  //     }
  //   },
  //   corruptAlertThreshold: 0 //0.00-1.00 (pct) allowed, default (.10) is wrongheaded
  // }),

  // pulls: new nedb({
  //   filename: path.resolve(config.cli.store.path, 'pulls.db'),
  //   inMemoryOnly: false, // false is default
  //   timestampData: true, // false is default adds createAt updatatedAt fields
  //   autoload: true, // false is default -- no need to call loadDatabase if true
  //   onload: (err) =>{
  //     if (err) {
  //       api.log('warn', `(store.pulls) error loading ${config.cli.store.path}/pulls.db`)
  //       api.log('error', err)
  //     }
  //   },
  //   corruptAlertThreshold: 0 //0.00-1.00 (pct) allowed, default (.10) is wrongheaded
  // }),
  //
  // templates: new nedb({
  //   filename: path.resolve(config.cli.store.path, 'templates.db'),
  //   inMemoryOnly: false, // false is default
  //   timestampData: true, // false is default {{data by key...}, createAt:date, updatedAt:date}
  //   autoload: true, // false is default -- no need to call loadDatabase if true
  //   onload: (err) =>{
  //     if (err) {
  //       api.log('warn', `(store.templates) error loading ${config.cli.store.path}/templates.db`)
  //       api.log('error', err)
  //     }
  //   },
  //   corruptAlertThreshold: 0 //0.00-1.00 (pct) allowed, default (.10) is wrongheaded
  // })
}

module.exports = exports = store = {

  batches: {

    get: (timestamp=new Date()) => {

      return new Promise( (resolve, reject) => {
        collections.batches.findOne({ createdAt : { $lte: timestamp } }, {_id: 0, batch: 1}).exec(function(err, doc) {
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
    put: (batch, rowsAffected) => {

      collections.batches.insert({batch, rowsAffected})

    }

  },
  errors: {

    getLast: function(query={}) {

      return new Promise( (resolve, reject) => {
        collections.commands.find(query, {_id: 0, batch: 1}).sort({createdAt: -1}).limit(1).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })

    },
    put: (error) => {

      collections.errors.insert({error})

    }

  },
  pools: {

    get: function(containerId) {

      return new Promise( (resolve, reject) => {
        collections.pools.findOne({_id: containerId}).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })

    },
    getLastInstanceId: async () => {

      return new Promise( (resolve, reject) => {
        collections.pools.findOne({}).sort({updatedAt: -1}).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(!doc? api.sqlCatalog.Instance: doc._id)
        })
      })

    },
    put: () => {

      collections.pools.insert({config: config.mssql, _id: api.sqlCatalog.Instance})

    },
    update: (upsert=true) => {

      let mssql = config.mssql
      let containerId=api.sqlCatalog.Instance
      collections.pools.update({_id: containerId}, {_id: containerId, mssql: config.mssql}, { upsert: upsert })

    }
  },
  lines: {

    get: function(query={}) {

      return new Promise( (resolve, reject) => {
        collections.lines.find(query).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc[0])
        })
      })

    },
    getLast: function(query={}) {

      return new Promise( (resolve, reject) => {
        collections.lines.find(query).sort({createdAt: -1}).limit(1).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc[0])
        })
      })

    },
    put: (line) => {

      collections.lines.insert({line})

    }

  },
  queries: {

    get: async (queryName) => {

      return new Promise( function(resolve, reject) {
        api.log('debug', `(store.queries.get) - get ${queryName}`)
        collections.templates.findOne({name: queryName}, {_id: 0, template: 1}).exec(function(err, doc) {
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
        collections.templates.findOne({name: queryName}, {_id: 0, text: 1}).exec( function(err, doc) {
          if (err) {
            api.log('error', err)
          } else {
            if (!doc) {
              api.log('warn', `(store.queries.getBatch) query '${queryName}' not found`)
            } else {
              api.log('debug', `(store.queries.getBatch)`)
              api.log('debug', doc)
              api.batch = [`-- ${queryName}`].concat(doc.text.split('\n'))
              resolve(api.log('debug', api.batch))
            }
          }
        })
      })

    },
    import: () => {

      collections.templates.count({}).exec(function(err, nbr) {
        if (err) {
          api.log('error', err);
        } else {
          if (!nbr) {
            api.log('log', '(store.queries.import) queries.js template strings into templates.db')
            const queriesjs = require('./queries.js')
            Object.keys(queriesjs).forEach((name) => {
              api.log('log', `(store.queries.getBatch) upsert query ${ name }\n${ queriesjs[name] }\n`)
              collections.templates.update( { name: name }, { $set: { text: queriesjs[name] } }, { upsert: true })
            })
          }
        }
      })

    },
    put: (queryName, query) => {

      collections.templates.update( { name: queryName }, { $set: { text: query } }, { upsert: true })
      //templates.insert({ name: queryName, text: query })

    },
    names: () => {

      return new Promise(function(resolve, reject) {
        try{
          collections.templates.find({}, {_id: 0, name: 1 }).exec(function(err, docs) {
            let list=[]
            if (err) throw err
            docs.forEach((doc) => {
              list.push(doc.name)
            })
            resolve(list.sort())
          })
        }
        catch (err) {
          reject(err)
        }
      })

    },
    remove: (queryName) => {

      collections.templates.remove({ name: queryName})

    },
    search: (textToFind) => {

      api.log('debug', `(store.queries.search) find query(s) containing ${textToFind}`)
      collections.templates.find({textToFind: {$IN: text}}).sort({}).exec(function(err, docs) {
        return docs
      })

    },
    update: (queryName, text) => {

      // Set an existing field's value
      collections.templates.update({name: queryName}, {$set: {template: text}}, {multi: false, upsert: false}, function (err, result) {
        if (err) {
          api.log('warn', `(store.queries.search) error`)
          api.log('error', err)
        } else {
          api.log('debug', `(store.queries.search) ${queryName} updated`)
        }
      })

    },
    upsert: (queryName, text) => {

      collections.templates.update({name: queryName}, {$set: {template: text}}, {multi: false, upsert: true}, function (err, result) {
        if (err) {
          api.log('warn', `(store.queries.upsert) error`)
          api.log('error', err)
        } else {
          api.log('debug', `(store.queries.upsert) ${queryName} updated:\n${result}`)
        }
      })

    }

  }, // end queries
  npm: {

    // the pull then in effect? not so sure the new Date will work...
    get: ( datetimestamp = new Date() ) => {
      let query = { createdAt: { $lte: datetimestamp } }
      let projection = {}
      api.log('debug', `(store.npm.get) get ${api.format(_id)} projection ${api.format(projection)}`)
      collections.npm.findOne(query, projection ).exec(function(err, doc) {
        if (err) throw err
        if (!doc) {
          api.log('warn', `(store.npm.get) no pull on or before ${datetimestamp}`)
        } else {
          api.log('debug', `(store.npm.get)`)
          api.log('debug', doc)
          return doc
        }
      })

    },
    put: (output) => {

      collections.npm.insert({output})

    }

  },
  pulls: {

    // the pull then in effect? not so sure the new Date will work...
    get: ( datetimestamp = new Date() ) => {
      let query = { createdAt: { $lte: datetimestamp } }
      let projection = {}
      api.log('debug', `(store.pulls.get) get ${api.format(_id)} projection ${api.format(projection)}`)
      collections.pulls.findOne(query, projection ).exec(function(err, doc) {
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
    put: (output) => {

      collections.pulls.insert({output})

    }

  },
  search: function(args) {

    return new Promise( (resolve, reject) => {

      let query=(args.options.query)? args.options.query: {}
      let projection=(args.options.projection)? args.options.projection: {}
      let skip=(args.options.skip)? args.options.sort: 0
      let sort=(args.options.sort)? args.options.sort: {}
      let limit=(args.options.limit)? args.options.limit: 8

  api.log('confirm', args)
  api.log('confirm', 'query')
  api.log('confirm', query)
  api.log('confirm','projection')
  api.log('confirm', projection)
  api.log('confirm', 'skip')
  api.log('confirm', skip)
  api.log('confirm', `sort ${typeof sort}`)
  api.log('confirm', sort)
  api.log('confirm', 'limit')
  api.log('confirm', limit)

      collections[args.collection].find(query).projection(projection).sort(sort).limit(limit).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
    })

  }


}
