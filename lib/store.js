////NPM
const nedb = require('nedb') // need the constructor
////core
const { createCipheriv, createDecipheriv, createSecretKey, randomBytes, scrypt} = require('crypto')
const path = require('path') // unqualified resolve conflicts with promises
////local
const { secret} = require('../lib/api')
const { log } = require('../lib/log')

const config = require('../config/config.json')
var cipher
var decipher
function genCollection(name) {
  let compactMs = 0
  let options = {
    autoload: true,
    corruptAlertThreshold: 0, // 0-1.0 w/default of .10? I desire no corruption
    filename: path.resolve(config.store.path, `${name}.db`),
    timestampData: true,
    inMemoryOnly: false, // false is default
    onload: err => {
      if (err) {
        log('log', `(genCollection) error loading ${config.store.path}/${name}.db`)
        log('error', err.message)
        log('error', err.stack)
      }
    },
  }
  let newdb = new nedb(options)
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
  templates: genCollection('templates'),
  tunes: genCollection('tunes')
}

module.exports = store = {
  collections: Object.keys(collections),
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
  setCryptr: phrase => {
    crypter = new Cryptr(phrase);
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
        resolve(doc)
      })
    })
  },
  tunes: {
    put: results => {
      if (results) collections.tunes.insert({results})
    },
    getLast: () => {
      return new Promise( (resolve, reject) => {
        collections.tunes.find(results).sort({createdAt: -1}).limit(1).exec(function(err, doc) {
          if (err) return reject(err)
          return resolve(doc[0])
        })
      })
    }
  },
  words: {
    get: (name) => {
      return new Promise( async (resolve, reject) => {
        try {
          collections.words.find({name: name}).exec( (err, doc) => {
            if (err) return reject(err)
            if (!doc.word) resolve()
            if (['phrase', 'salt'].includes(doc.word)) {
              resolve(word)
            } else {
              let decrypted = decipher.update(doc.word, 'hex', 'utf8')
              decrypted = this.decipher.final('utf8')
              resolve(decrypted)
            }  
          })
        }
        catch(err) {
          reject(err)
        }  
      })
    },
    getLast: (name) => {
      return new Promise( async (resolve, reject) => {
        try {
          collections.words.find({name: name}).sort({createdAt: -1}).limit(1).exec(function(err, doc) {
            if (err) return reject(err)
            if (doc.word) {
              if (['phrase', 'salt'].includes(doc.word)) {
                resolve(word)
              } else {
                let decrypted = decipher.update(doc.word, 'hex', 'utf8')
                decrypted = this.decipher.final('utf8')
                resolve(decrypted)
              }  
            } else resolve()
          })
        }
        catch(err) {
          reject(err)
        }  
      })
    },
    setKeys: async () => {
      new Promise( async (resolve, reject) => {
        try {
          // CostFactor (N):            Integer  CPU/memory cost parameter - Must be a power of 2 (e.g. 1024)
          // BlockSizeFactor (r):       Integer  blocksize parameter (8 is commonly used)
          // ParallelizationFactor (p): Integer  Parallelization parameter. (1..232-1 * hLen/MFlen)
          let phrase = await store.words.getLast('phrase') 
          if (!phrase) phrase = randomBytes(25).toString('hex') 
            //await secret('Passphrase for stored secrets encryption key')
          let salt = await store.words.getLast('salt') 
          if (!salt) salt = randomBytes(25).toString('hex') 
          //await secret('salt bytes for stored secrets')
          scrypt(phrase, salt, 32, { N: 1024, r: 8 }, (err, derivedKey) => {
            if (err) throw err
            scrypt(phrase, salt, 16, { N: 512 }, async (err, derivedIv) => {
              if (err) throw err
              const key = derivedKey.toString('hex').substring(0, 32)
              const iv = derivedIv.toString('hex').substring(0, 16)
              cipher = createCipheriv(config.store.algorithm, key, iv)
              decipher = createDecipheriv(config.store.algorithm, key, iv)
              await store.words.upsert('phrase', phrase)
              await store.words.upsert('salt', salt)
              resolve()
            })
          })    
        }
        catch(err) {
          reject(err)
        }  
      })  
    },
    upsert: async (name, word) => {
      new Promise( async (resolve, reject) => {
        try {
          if (['phrase', 'salt'].includes(name)) {
            collections.words.update( { name: name }, { $set: { word: word } }, { upsert: true })
          } else {
            let encrypted = cipher.update(word, 'utf8', 'hex')
            encrypted += cipher.final('hex')
            collections.words.update( { name: name }, { $set: { word: encrypted } }, { upsert: true })
          }
          resolve()
        }  
        catch(err) {
          reject(err)
        }  
      })
    }
  }
}


