"use strict;"
// NPM
const commands = require(`./lib/commands`);

// function compile(cacheObject) {
//   let str=``;
//   if (!Array.isArray(cacheObject)) {
//     Object.keys(cacheObject).forEach((key) => {
//       if (!['i', 'q', 'Q'].includes(key)) {
//         str+=` -${key}`;
//         if (key!=cacheObject[key]) {
//           str+= typeof cacheObject[key]=='string'?  `\'${cacheObject[key]}\'`:cacheObject[key];
//         }
//       }
//     });
//   } else {
//     str = cacheObject.join('\n')
//   }
//   return str;
//
// }
//
// function getfiles(parentFolder) {
//   return fs.readdirAsync(parentFolder)
//   .then( function(members) {
//     let files = [];
//     for (i in members) {
//       let stat = fs.statSync(results[i]);
//       if (stat && !stat.isDirectory()) {
//         files.push(results[i]);
//       }
//     }
//     return files;
//   })
//   .catch((e) => { throw(e); });
// }
//
// function getScript(scriptFile) {
//   // returns the contents of a file in scripts folder
//   return fs.readFileAsync(path.join(config.scriptPath, scriptFile), 'utf8')
//     .then(function(fileScript) {
//       return fileScript;
//     })
//     .catch((e) => { throw(e); });
//   }

// function tsql(qry, callback) {
//   // disconnect after each qry - use sqlcmd -q for pesistent ad hoc connection
//   return mssql.connect({
//       user: Switch.U,
//       password: Switch.P,
//       server: Switch.S,
//       database: Switch.d,
//       pool: config.odbcPool })
//     .then( function (cn) {
//       if (!qry) qry=tools.compile(Batch)
//       new mssql.Request(cn).query(qry)
//       .then( function(results) {
//         callback(results);
//       })
//       .catch((e) => { throw(e); });
//     })
//     .catch((e) => { throw(e); });
// }

// log.log(colors.rainbow(commands._banner));
//
// commands.getScript('testQuery.sql')
// .then( function(fileScript) {
//
//   commands.tsql(fileScript, function(results) {
//
//     results.forEach( function(result) {
//       log.log(prettyjson.render(results[0]));
//     })
//
//   });
//
//   commands.tsql(queries.getVersion, function(results) {
//
//     log.log(prettyjson.render(results[0]));
//
//     log.log(prettyjson.render({
//       'mssql version': childProcess.execSync(`npm mssql -version`).toString(),
//       'sqlcmd version':  childProcess.execSync(`/opt/mssql-tools/bin/sqlcmd | grep Version`).toString(),
//       'bcp version':  childProcess.execSync(`/opt/mssql-tools/bin/bcp -v | grep Version`).toString()
//     }));
//
//     log.log(colors.cyan(`\nenter T-SQL or sqlpal commands at the prompt`));
//     log.log(colors.cyan(`   type 'help' for sqlpal commands  overview`));
//
//   });
// })
// .catch( function(err) {
//   console.error('failed to initiaize sqlpal', err);
//   process.exit(1);
// });
