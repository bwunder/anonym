"use strict;"
// NPM
const prettyjson =  require('prettyjson');
const Promise = require('bluebird');
// core
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
// local
const config = require('./config');

module.exports = exports = tools = {

  archiveBatches: () => {

    return fs.writeFileAsync(path.resolve(config.batchPath, tools.formatLocalDate() + '_Batch.hist'), config.BatchHistory, 'utf8')
    .then(function(result) {
      log.log(result);
    })
    .catch((e) => { log.error(e); });

  },

  bandAid: `
    ##################################################################
   ##########@@@@####@@@@###@@         @@@@######@@######@@############
  ##########@@##@@##@@##@@##@@  \\ O /  @@##@@###@@@@#####@@#############
  ###########@@#####@@##@@##@@    |    @@##@@##@@##@@####@@#############
  #############@@###@@##@@##@@   / \\   @@@@####@@@@@@####@@#############
  ##########@@##@@##@@##@@##@@         @@#####@@####@@###@@#############
   ##########@@@@####@@\\@###@@@@@@     @@####@@######@@##@@@@@@########
    ####################\\#############################################
  `,

  commandAid: (commands) => {

    let builtins=[], names=[];
    commands.forEach( (command) => {
      if (command._name) {
// would be better to use names already hardcoded in to message?
        if (['HELP', 'EXIT', 'WHO', 'VANTAGE', 'REPL', 'LOGLEVEL'].includes(command._name.toUpperCase())) {
          builtins.push(command._name);
        } else {
          names.push(command._name);
        }
      }
    });

    return [`T-SQL Line reader builds the query Batch and responds to KEYWORD commands`,
      `\n  1. Batch Terminators`.green + `  instigate mssql package driven database I/O `,
      `       GO`.green + `        Test the Batch, if OK process via .query() & clear`,
      `       RUN`.green + `       Test the Batch, if OK process via .batch() & clear`,
      `       TEST`.green + `      process via .query() with SET NOEXEC ON then resume`,
      `\n  2. Vorpal CLI`.cyan + `  the CLI of Vantage's distributed real-time CLI`,
      (`      Vantage builtins:  ${builtins.join(' | ')}  `),
      (`      SQL Instance Mgmt:` + ` ${names.join(' | ')}  `.cyan),
      `\n  3. Batch Injectors`.magenta ,
      `       ARCHIVE`.magenta + `   Batches processed - session './history' files`,
      `       HISTORY`.magenta + `   Batches in history (saved at session close)`,
      `       QUERY`.magenta + `     User defined queries as saved in queries.js`,
      `       SCRIPT`.magenta + `    User defined scripts as saved in './scripts'`,
      ``].join(`\n`);

  },

  compile: (cacheObject) => {

   let str=``;
   if (!Array.isArray(cacheObject)) {
     Object.keys(cacheObject).forEach((key) => {
       if (!['i', 'q', 'Q'].includes(key)) {
         str+=` -${key}`;
         if (key!=cacheObject[key]) {
           str+= typeof cacheObject[key]=='string'?  ` \'${cacheObject[key]}\'`:cacheObject[key];
         }
       }
     });
   } else {
     str = cacheObject.join('\n').replace(/`/g, "'");
   }
   return str;

   },

   formatLocalDate: () => {

       var now = new Date(),
           tzo = -now.getTimezoneOffset(),
           dif = tzo >= 0 ? '+' : '-',
           pad = function(num) {
               var norm = Math.abs(Math.floor(num));
               return (norm < 10 ? '0' : '') + norm;
           };
       return now.getFullYear()
           + '-' + pad(now.getMonth()+1)
           + '-' + pad(now.getDate())
           + 'T' + pad(now.getHours())
           + ':' + pad(now.getMinutes())
           + ':' + pad(now.getSeconds())
           + dif + pad(tzo / 60)
           + ':' + pad(tzo % 60);
   },

  getScript: (scriptFile) => {

   return fs.readFileAsync(path.resolve(config.scriptPath, scriptFile), 'utf8')
   .then(function(fileScript) {
     return fileScript;
   })
   .catch((e) => { log.error(e); });

  },

  isValidBatch: (Batch) => {

    let valid = true;
    let script = tools.compile([`SET NOEXEC ON;`].concat(Batch));

    pool.request().query(script).then(() => {
     // never executes, but does catch first sql server exception raised
    })
    .catch( (err) => {
      valid=false;
    });
    return valid;

  },

  gigo: (gi) => {

    let go='';

    switch (typeof gi) {

      case ('undefined'):
        go = 'undefined'.grey;
        break;

      case ('boolean'):

        go = !gi? gi.red: gi.green;
        break;

      case ('number'):

        go = gi.blue;
        break;

      case ('string'):

        try {
          if (JSON.parse(gi)) {
            go = prettyjson.render(JSON.parse(gi));
          }
        }
        catch(e) {
          go = gi;
        }
        break;

      case ('object'):

        switch (true) {
          case (Buffer.isBuffer(gi)):
            go = prettyjson.render(gi.toString());
            break;
          case (Array.isArray(gi)):
            if (gi.recordsets) {
              gi.recordsets.forEach(function(rs) {
                go += prettyjson.render(rs);
              });
            } else {
              gi.forEach(function(result) {
                go += prettyjson.render(result);
              });
            }
            break;
          default:
            go = prettyjson.render(gi);
            break
        }
        break;

      default:

        go = `unexpected type ${typeof gi}`.inverse;
        break;

    }

    return go + '\n';

  }

}
