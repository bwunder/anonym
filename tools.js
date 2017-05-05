"use strict;"
// NPM
const prettyjson =  require('prettyjson');
const Promise = require('bluebird');
// core
const childProcess = Promise.promisifyAll(require('child_process'));
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
// local
const config = require('./config');

module.exports = exports = tools = {
  bandaid: `
    ##################################################################
   ##########@@@@####@@@@###@@         @@@@######@@######@@############
  ##########@@##@@##@@##@@##@@  \\ O /  @@##@@###@@@@#####@@#############
  ###########@@#####@@##@@##@@    |    @@##@@##@@##@@####@@#############
  #############@@###@@##@@##@@   / \\   @@@@####@@@@@@####@@#############
  ##########@@##@@##@@##@@##@@         @@#####@@####@@###@@#############
   ##########@@@@####@@\\@###@@@@@@     @@####@@######@@##@@@@@@########
    ####################\\#############################################
  `,
  commandAid: (names) => {
    return [`prompt interprets T-SQL plus three kinds of CLI instructions`,
      `T-SQL lines accumulate into a Batch cache of query lines until terminated`,
      `Use the grave (\`) to enquote literals when building ad hoc Batch at the prompt.`,
      `  1. Terminators send the Batch to SQL Server using mssql NPM package`,
      `       GO        Test then process the Batch via mssql.Request().query()`,
      `       RUN       Test then process the Batch via mssql.Request().batch()`,
      `       TEST      DB Engine query parse (SET NOEXEC ON) then resume the Batch`,
      `  2. Admistrative Commands for the Docker contained SQL Server on Lnux instance`,
      `  ${names.join(' ').toUpperCase()}`,
      `       HELP      Shows usage overview for CLI commands (or try 'LIST -v')`,
      `  3. Injectors overload the Batch with a previous query, script or Batch`,
      `       ARCHIVE   Batches processed - previous sessions from file`,
      `       HISTORY   Batches processed - current session from vantage`,
      `       QUERY     Queries (from query module)`,
      `       SCRIPT    Files (from ./scripts subfolder)`].join(`\n`);
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

          case (Buffer.isBuffer(gi)):

            try {
              if (JSON.parse(gi.toString())) {
                 go = prettyjson.render(JSON.parse(gi.toString()));
              }
            }
            catch (e) {
              go = prettyjson.render([gi.toString()]);
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
