// sqlpal adopts sqlpad's query store
const nedb = require('nedb');
const Promise = require('bluebird');

const config = require(`./config.json`);
const lib = require(`./lib.js`);

const queries = new nedb({ filename: 'sqlpaddata/queries.db', autoload: true });

// oneoff load queries.js template strings into sqlpal's nedb queries collection
// const queriesjs = require('./queries.js');
// Object.keys(queriesjs).forEach((name) => {
//   log.log(`name ${name}\n${queriesjs[name]}`)
//   queryStore.insert(name, queriesjs[name]);
// })

//  queries schema(?)
//{[
//  {
//    _id: Joi.string().optional(), // id from nedb
//    name: Joi.string().required(),
//    tags: Joi.array().items(Joi.string().empty('')).sparse().optional(),
//    connectionId: Joi.string().optional().empty(''),
//    queryText: Joi.string().optional().empty(''),
//    chartConfiguration: Joi.object({
//      chartType: Joi.string().optional().empty(''),
//      fields: Joi.object().unknown(true).optional()
//    }).optional(),
//    createdDate: Joi.date().default(new Date(), 'time of creation'),
//    modifiedDate: Joi.date().default(new Date(), 'time of modification'),
//    createdBy: Joi.string().required(),
//    modifiedBy: Joi.string().required(),
//    lastAccessDate: Joi.date().default(new Date(), 'time of last access')
//  }, ... ]}

module.exports = exports = queryStore = {

  get: (queryName, projection={}) => {

    lib.log('debug', `query store - get ${queryName} projection ${projection}`);
    queries.findOne({name: queryName}, projection).exec(function(err, doc) {
      if (err) {
        lib.log('error', err);
      } else {
        lib.log('log', doc);
      }
    });

  },
  getBatch: Promise.promisify( (queryName) => {

    lib.log('debug', `loading script '${queryName}' from nedb query store to cache`);
    queries.findOne({name: queryName}, {_id: 0, queryText: 1}).exec( function(err, doc) {
      if (err) {
        lib.log('error', err);
      } else {
        if (!doc) {
          lib.log('warn', `query not found`)
        } else {
          lib.log('debug', doc);
          config.cache.batch.splice(0);
          doc.queryText.split('\n').forEach( function(line) {
            config.cache.batch.push(line);
          });
          lib.log('debug', config.cache.batch);
        }
      }
    });

  }),
  insert: (queryName, query) => {

    queries.insert(
      { name: queryName,
        queryText: query },
      function(err, doc) {
          lib.log('debug', `query store - insert query ${doc.name}`);
      });

  },
  list: (query={}, projection={_id: 0, name: 1, queryText: 1 }, sort) => {

    lib.log('debug', `query store - list  query ${query} projection ${projection}`);
    queries.find(query, projection).sort(sort).exec(function(err, docs) {
      docs.forEach((doc) => {
        lib.log('log', `${doc.name}`.bold + ` ${"\n" + doc.queryText + "\n"}`);
      });
    });

  },
  names: (query={}, projection={_id: 0, name: 1 }, sort) => {

    lib.log('debug', `query store - names  query ${query} projection ${projection}`);
    queries.find(query, projection).sort(sort).exec(function(err, docs) {
      docs.forEach((doc) => {
        lib.log('log', `${doc.name}  `.bold);
      });
    });

  },
  remove: (queryName) => {

    queries.remove({ name: queryName}, function(err, numDeleted) {
      lib.log('debug', `query store - query ${queryName} removed`);
    });

  },
  search: (textToFind) => {

    lib.log('debug', `query store - find query(s) containing ${textToFind}`);
    queries.find({textToFind: {$IN: queryText}}).sort({}).exec(function(err, docs) {
      return docs;
    });

  },
  update: (queryName, text) => {

    // Set an existing field's value
    queries.update({name: queryName}, {$set: {queryText: text}}, {multi: false}, function (err, result) {
      if (err) {
        lib.log('error', err);
      } else {
        lib.log('debug', `${queryName} updated`);
      }
    });

  },
  upsert: (queryName, text) => {

    // update existing field value(s) else add key to existing object else add new object if not one

  }

};
