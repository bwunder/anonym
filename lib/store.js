////NPM
const nedb = require('nedb')
////core
const path = require('path')
////local
const config = require('../config/config.json')

// memory-only is implicit if no filename, but to be explicit:
//const batch = new nedb({inMemoryOnly: true})
function genCollection(name) {

  let compactMs = 0
  let newdb = new nedb({
    filename: path.resolve(config.cli.store.path, `${name}.db`),
    timestampData: true,
    inMemoryOnly: false, // false is default
    autoload: true,
    onload: (err) => {
      if (err) {
        process.stdout.write(`(genCollection) error loading ${config.cli.store.path}/${name}.db\n`)
        process.stderr.write(err.message+'\n')
        process.stderr.write(err.stack+'\n')
      }
    },
    corruptAlertThreshold: 0, // 0-1.0 w/default of .10? I would prefer .00, we'll see what happens
  })
  newdb.persistence.setAutocompactionInterval(compactMs)
  return newdb

}

// queries and results, not collections are exported - prolly protects RAM more than data
const collections = {

  batches: genCollection('batches'),
  pools: genCollection('pools'),
  errors: genCollection('errors'),
  lines: genCollection('lines'),
  npm: genCollection('npm'),
  pulls: genCollection('pulls'),
  runs: genCollection('runs'),
  templates: genCollection('templates')

}

module.exports = exports = {

  batches: {

    get: (timestamp=new Date()) => {

      return new Promise( (resolve, reject) => {
        collections.batches.findOne({ createdAt : { $lte: timestamp } }, {_id: 0, batch: 1}).exec(function(err, doc) {
          if (err) reject(err)
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
          resolve(doc? doc._id: undefined)
        })
      })

    },
    update: (containerId, pool, upsert=true) => {

      // all or nothing 
      // one active pool per container per sqlpal? seems appropriate
      // or a non-unique index on ContainerId key and no pool count constraint 
      collections.pools.update({_id: containerId}, {_id: containerId, pool: pool}, { upsert: upsert })

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

    extract: () => {

      return new Promise(function(resolve, reject) {
        try {
          collections.templates.find({}, {_id: 0, name:1, text: 1}).exec(function(err, doc) {
            if (err) throw err
            return resolve(doc)
          })
        }  
        catch(err) {
          reject(err)
        }  
      })

    },
    get: async (queryName) => {

      return new Promise( function(resolve, reject) {
        try {
          collections.templates.findOne({name: queryName}, {_id: 0, text: 1}).exec(function(err, doc) {
            if (err) throw err
            resolve(doc.text)
          })
        }
        catch(err) {
          reject(err)
        }  
      })

    },
    getBatch: (queryName) => {

      return new Promise(function(resolve, reject) {
        try {
          collections.templates.findOne({name: queryName}, {_id: 0, text: 1}).exec( function(err, doc) {
            if (err) reject(err)
            resolve(doc.text.split(`\n`))
          })
        }
        catch(err) {
          reject(err)
        }  
      })

    },
    import: () => {

      new Promise(function(resolve, reject) {
        try {
          const queriesjs = require('./queries.js')
          Object.keys(queriesjs).forEach((name) => {
            collections.templates.update( { name: name }, { $set: { text: queriesjs[name] } }, { upsert: true })
          })
          resolve('queries.js upserted into templates collection')
        }  
        catch(err) {
          reject(err)
        }  
      })

    },
    put: (queryName, query) => {

      new Promise(function(resolve, reject) {
        try {
          resolve(collections.templates.update( { name: queryName }, { $set: { text: query } }, { upsert: true }))
        }  
        catch(err) {
          reject(err)
        }  
      })

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

      
      new Promise(function(resolve, reject) {
        try {
          resolve(collections.templates.remove({ name: queryName}))
        }  
        catch(err) {
          reject(err)
        }  
      })

    },
    search: (textToFind) => {

      collections.templates.find({text: {$IN: textToFind}}).sort({}).exec(function(err, docs) {
        return docs
      })

    },
    update: (queryName, text) => {

      // Set an existing field's value
      collections.templates.update({name: queryName}, {$set: {text: text}}, {multi: false, upsert: false}, function (err, result) {
        if (err) {
          process.stderr.write(`(store.queries.search) error\n`)
          process.stderr.write(err.stack + '\n')
        }
        return result
      })

    },
    upsert: (queryName, text) => {

      collections.templates.update({name: queryName}, {$set: {text: text}}, {multi: false, upsert: true}, function (err, result) {
        if (err) {
          process.stderr.write(`(store.queries.upsert) error\n`)
          process.stderr.write(err.stack + '\n')
        }
        return result
      })

    }

  }, // end queries
  npm: {

    // the pull then in effect? not so sure the new Date will work...
    get: ( datetimestamp = new Date() ) => {
      let query = { createdAt: { $lte: datetimestamp } }
      let projection = {}
      collections.npm.findOne(query, projection ).exec(function(err, doc) {
        if (err) throw err
        return doc
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
      collections.pulls.findOne(query, projection ).exec(function(err, doc) {
        if (err) throw err
        return doc
      })

    },
    put: (output) => {

      collections.pulls.insert({output})

    }

  },
  search: function(args) {

    return new Promise( (resolve, reject) => {
process.stdout.write(require('util').inspect(args))      
      let query=(args.options.query)? args.options.query: {}
      let projection=(args.options.projection)? args.options.projection: {}
      let skip=(args.options.skip)? args.options.skip: 0
      let sort=(args.options.sort)? args.options.sort: {}
      let limit=(args.options.limit)? args.options.limit: 8
      collections[args.collection].find(query).projection(projection).sort(sort).skip(skip).limit(limit).exec(function(err, doc) {
        if (err) return reject(err)
        return resolve(doc)
      })
    })

  }

}
