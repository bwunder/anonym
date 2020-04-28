////NPM
const nedb = require('nedb')
////core
const path = require('path')
////local
const config = require('../config/config.json')

// !! insert already encrypted anywhere

// memory-only is implicit if no filename, but to be explicit could say:
//const scratch = new nedb({inMemoryOnly: true})
function genCollection(name) {
  let compactMs = 0
  let newdb = new nedb({
    filename: path.resolve(config.store.path, `${name}.db`),
    timestampData: true,
    inMemoryOnly: false, // false is default
    autoload: true,
    onload: err => {
      if (err) {
        log('log', `(genCollection) error loading ${config.store.path}/${name}.db`)
        log('error', err.message)
        log('error', err.stack)
      }
    },
    corruptAlertThreshold: 0, // 0-1.0 w/default of .10? I would prefer .00, we'll see what happens
  })
  newdb.persistence.setAutocompactionInterval(compactMs)
  return newdb
}

// collections not exported 
const collections = {
  errors: genCollection('errors'),
  words: genCollection('words'),
  lines: genCollection('lines'),
  pools: genCollection('pools'),
  poolsArchive: genCollection('poolsArchive'),
  pulls: genCollection('pulls'),
  runs: genCollection('runs'),
  scripts: genCollection('scripts'),
  subprocesses: genCollection('subprocesses'),
  templates: genCollection('templates')
}

module.exports = exports = {

  collections: Object.keys(collections),
  compactAll: async () => {
    // called at shutdown - errors handled by the process unhandler
    return new Promise( async (resolve, reject) => {
      for (let db of collections) {
        await db.persistence.compactDatafile()
      }
      resolve()
      })  
    },
  errors: {
    getLast: (query={}) => {
      return new Promise( (resolve, reject) => {
        collections.commands.find(query, {_id: 0, batch: 1}).sort({createdAt: -1}).limit(1).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })
    },
    put: error => {
      collections.errors.insert({error})
    }
  },
  lines: {
    get: (query={}) => {
      return new Promise( (resolve, reject) => {
        collections.lines.find(query).exec( (err, doc) => {
          if (err) return reject(err)
          return resolve(doc[0])
        })
      })
    },
    getLast: (query={}) => {
      return new Promise( (resolve, reject) => {
        collections.lines.find(query).sort({createdAt: -1}).limit(1).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc[0])
        })
      })
    },
    put: line => {
      if (line) collections.lines.insert({line})
    }
  },
  pools: {
    archive: (containerId) => {
      return new Promise( (resolve, reject) => {
        collections.pools.findOne({_id: containerId}).exec(function(err, doc) {
          if (err) return reject(err)
          doc.containerId = containerId
          collections.poolsArchive.insert({doc})
          collections.pools.remove({_id: containerId})
          return resolve()
        })
      })
      // we add & maintain one record per container - upsert does it all
      collections.pools.update({_id: containerId}, {_id: containerId, pool: pool}, { upsert: upsert })
    },
    get: containerId => {
      return new Promise( (resolve, reject) => {
        collections.pools.findOne({_id: containerId}).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc)
        })
      })
    },
    getLastInstanceId: async () => {
      return new Promise( (resolve, reject) => {
        collections.pools.findOne({}).sort({updatedAt: -1}).exec( (err, doc) => {
          if (err) return reject(err)
          resolve(doc? doc._id: undefined)
        })
      })
    },
    update: (containerId, pool, upsert=true) => {
      // we add & maintain one record per container - upsert does it all
      collections.pools.update({_id: containerId}, {_id: containerId, pool: pool}, { upsert: upsert })
    }
  },
  pulls: {
    get: ( datetimestamp = new Date() ) => {
      let query = { createdAt: { $lte: datetimestamp } }
      let projection = {}
      collections.pulls.findOne(query, projection ).exec( (err, doc) => {
        if (err) throw err
        return doc
      })
    },
    put: (output) => {
      collections.pulls.insert({output})
    }
  },
  runs: {
    get: ( datetimestamp = new Date(), limit=5) => {
      let query = { createdAt: { $lte: datetimestamp } }
      collections.runs.find(query).sort({updatedAt: -1}).limit(limit).exec( (err, doc) => {
        if (err) throw err
        return doc
      })
    },
    put: (output) => {
      collections.runs.insert({output})
    }
  },
  scripts: {
    extract: () => {
      return new Promise( (resolve, reject) => {
        try {
          collections.scripts.find({}, {_id: 0, name:1, text: 1}).exec(function(err, doc) {
            if (err) throw err
            return resolve(doc)
          })
        }  
        catch(err) {
          reject(err)
        }  
      })
    },
    get: async scriptName => {
      return new Promise( (resolve, reject) => {
        try {
          collections.scripts.findOne({name: scriptName}, {_id: 0, text: 1}).exec( (err, doc) => {
            if (err) throw err
            resolve(doc.text)
          })
        }
        catch(err) {
          reject(err)
        }  
      })
    },
    put: (scriptName, text) => {
      new Promise( (resolve, reject) => {
        try {
          resolve(collections.scripts.update( { name: scriptName }, { $set: { text: text } }, { upsert: true }))
        }  
        catch(err) {
          reject(err)
        }  
      })
    },
    names: () => {
      return new Promise( (resolve, reject) => {
        try{
          collections.scripts.find({}, {_id: 0, name: 1 }).exec( (err, docs) => {
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
    remove: scriptName => {      
      new Promise( (resolve, reject) => {
        try {
          resolve(collections.scripts.remove({ name: scriptName}))
        }  
        catch(err) {
          reject(err)
        }  
      })
    },
    search: textToFind => {
      // ???should this project names or what???
      collections.scripts.find({text: {$IN: textToFind}}).sort({}).exec( (err, docs) => {
        return docs
      })
    },
    update: (scriptName, text) => {
      // Set an existing field's value
      collections.scripts.update({name: scriptName}, {$set: {text: text}}, {multi: false, upsert: false}, (err, result) => {
        if (err) {
          process.stderr.write(`(store.scripts.update) error\n`)
          process.stderr.write(err.stack + '\n')
        }
        return result
      })
    }
  }, 
  subprocesses: {
    getLast: async (name) => {
      return new Promise( (resolve, reject) => {
        collections.subprocesses.findOne({name: name}, {_id: 0, pid: 1}).sort({updatedAt: -1}).exec( (err, doc) => {
          if (err) return reject(err)
          resolve(doc? doc: undefined)
        })
      })
    },
    list: async () => {
      return new Promise( (resolve, reject) => {
        try {
          let query = {}
          collections.subprocesses.find({}, {_id: 0, name: 1, pid: 1}).exec( (err, doc) => {
            if (err) throw err
            resolve(doc)
          })
        }
        catch(err) {
          reject(err)
        }  
      })
    },
    put: (name, pid) => {
      new Promise( (resolve, reject) => {
        try {
          resolve(collections.subprocesses.update( { name: name }, { $set: { pid: pid } }, { upsert: true }))
        }  
        catch(err) {
          reject(err)
        }  
      })
    }
  },
  templates: {
    extract: () => {
      return new Promise( (resolve, reject) => {
        try {
          collections.templates.find({}, {_id: 0, name:1, text: 1}).exec( (err, doc) => {
            if (err) throw err
            return resolve(doc)
          })
        }  
        catch(err) {
          reject(err)
        }  
      })
    },
    get: async queryName => {
      return new Promise( (resolve, reject) => {
        try {
          collections.templates.findOne({name: queryName}, {_id: 0, text: 1}).exec( (err, doc) => {
            if (err) throw err
            resolve(doc.text)
          })
        }
        catch(err) {
          reject(err)
        }  
      })
    },
    import: () => {

      // ???not getting updates to the store????

      new Promise( (resolve, reject) => {
        try {
          let queriesjs = require('./queries.js')
          Object.keys(queriesjs).forEach( name => {
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
      new Promise( (resolve, reject) => {
        try {
          resolve(collections.templates.update( { name: queryName }, { $set: { text: query } }, { upsert: true }))
        }  
        catch(err) {
          reject(err)
        }  
      })
    },
    names: (filter='') => {
      return new Promise( (resolve, reject) => {
        try{
          collections.templates.find({}, {_id: 0, name: 1 }).exec( (err, docs) => {
            let list=[]
            if (err) throw err
            docs.forEach( doc => {
              if (!filter || doc.name.includes(filter)) {
                list.push(doc.name)
              }  
            })
            resolve(list.sort())
          })
        }
        catch (err) {
          reject(err)
        }
      })
    },
    remove: queryName => {     
      new Promise( (resolve, reject) => {
        try {
          resolve(collections.templates.remove({ name: queryName}))
        }  
        catch(err) {
          reject(err)
        }  
      })
    },
    search: textToFind => {
      collections.templates.find({text: {$IN: textToFind}}).sort({}).exec( (err, docs) => {
        return docs
      })
    },
    update: (queryName, text) => {
      // Set an existing field's value
      collections.templates.update({name: queryName}, {$set: {text: text}}, {multi: false, upsert: false}, (err, result) => {
        if (err) {
          process.stderr.write(`(store.templates.update) error\n`)
          process.stderr.write(err.stack + '\n')
        }
        return result
      })
    },
    upsert: (queryName, text) => {
      collections.templates.update({name: queryName}, {$set: {text: text}}, {multi: false, upsert: true}, function (err, result) {
        if (err) {
          process.stderr.write(`(store.templates.upsert) error\n`)
          process.stderr.write(err.stack + '\n')
        }
        return result
      })
    }
  },
  search: (collection, find, projection, sort, limit, skip) => {
    return new Promise( (resolve, reject) => {      
      collections[collection].find(find).projection(projection).sort(sort).skip(skip).limit(limit).exec( (err, doc) => {
        if (err) return reject(err)
        return resolve(doc)
      })
    })
  },
  words: {  
    get: (name) => {
      return new Promise( (resolve, reject) => {
        collections.words.find({name: name}).exec( (err, doc) => {
          if (err) return reject(err)
          return resolve(doc[0])
        })
      })
    },
    getLast: (name) => {
      return new Promise( (resolve, reject) => {
        collections.words.find({name: name}).sort({createdAt: -1}).limit(1).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc[0]? doc[0].word: "")
        })
      })
    },
    put: (name, word) => {
      new Promise( (resolve, reject) => {
        try {
          resolve(collections.templates.update( { name: name }, { $set: { word: word } }, { upsert: true }))
        }  
        catch(err) {
          reject(err)
        }  
      })
    }
  }
}
