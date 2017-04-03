const path = require('path');
const mssql = require('mssql');
const Promise = require('bluebird');
// core
const fs = Promise.promisifyAll(require('fs'));
// local
const config = require('./config');
const { Switch, Prefix, Batch } = require(`./cache`);

module.exports = {

  compile: function (cacheObject) {
    let str=``;
    if (!Array.isArray(cacheObject)) {
      Object.keys(cacheObject).forEach((key) => {
        if (!['i', 'q', 'Q'].includes(key)) {
          str+=` -${key}`;
          if (key!=cacheObject[key]) {
            str+= typeof cacheObject[key]=='string'?  `\'${cacheObject[key]}\'`:cacheObject[key];
          }
        }
      });
    } else {
      str = cacheObject.join('\n')
    }
    return str;
  },

  formatLocalDate: function() {
    // duckduckgo.search.header.@MattJohnson
    if (this.config.printDate) {
      let now = new Date();
      let tzo = -now.getTimezoneOffset();
      let dif = tzo >= 0 ? `+` : `-`;
      let pad = function(num) {
        let norm = Math.abs(Math.floor(num));
        return (norm < 10 ? `0` : ``) + norm;
         };
     return now.getFullYear()
         + `-` + pad(now.getMonth()+1)
         + `-` + pad(now.getDate())
         + `T` + pad(now.getHours())
         + `:` + pad(now.getMinutes())
         + `:` + pad(now.getSeconds())
         + dif + pad(tzo / 60)
         + `:` + pad(tzo % 60);
    }
  },

  files: function(parentFolder) {
    return fs.readdirAsync(parentFolder)
    .then( function(members) {
      let files = [];
      for (i in members) {
        let stat = fs.statSync(results[i]);
        if (stat && !stat.isDirectory()) {
          files.push(results[i]);
        }
      }
      return files;
    })
    .catch((e) => { throw(e); });
  },

  runScript: function (scriptFile, callback) {
    // returns the contents of a file in scripts folder
    return fs.readFileAsync(path.join(config.scriptPath, scriptFile), 'utf8')
      .then(function(fileContent) {
console.log(fileContent);
        return fileContent;
      })
      .catch((e) => { throw(e); });
  },

  tsql: function (qry, callback) {
    // disconnect after each qry - use sqlcmd -q for pesistent ad hoc connection
    return mssql.connect({
        user: Switch.U,
        password: Switch.P,
        server: Switch.S,
        database: Switch.d,
        pool: config.odbcPool })
      .then( function (cn) {
        if (!qry) qry=tools.compile(Batch)
        new mssql.Request(cn).query(qry)
        .then( function(results) {
          callback(results);
        })
        .catch((e) => { throw(e); });
      })
      .catch((e) => { throw(e); });
  },

}
// fs.readFileAsync('./scripts/ioByQuery.sql', 'utf8')

// .then((data) => {
//   tsql(data);
// })
// .catch((e) => console.error(e));


//   const sqlTools = {
//
//     helpdb: db.input('dbname', mssql.VarChar(128), Switch.d) // undefined does them all
//       .execute(`sp_helpdb`, function(err, recordsets, returnValue) {
//         if (err) {
//           log.debug(`sp_helpdb failed`);
//           log.error(err.stack);
//         } else {
//           for (i in recordsets) {
//             for (j in recordsets[i]){
//              if (recordsets[i][j] && recordsets[i][j].status) {
//                 let status = recordsets[i][j].status.replace(/=/g, `":"`).split(',');
//                 for (k in status) {
//                   if (!/:/.test(status[k])) {
//                     status[k] = `"${status[k].trim()}":"${status[k].trim()}"`
//                   } else {
//                     status[k] = `"${status[k].trim()}"`;
//                   }
//                 }
//                 recordsets[i][j].status = JSON.parse(`{${status.join()}}`);
//                 recordsets[i][j].db_size.trim();
//               }
//               log.log(`\n`+inspect(recordsets[i][j]));
//             }
//           }
//         }
//       })
//       .catch((e) => log.error(`helpdb error: ${e}`)),
//
//     principal: function(name) {
//
//       db.query( `SELECT '${name}', SUSER_ID('${name}') AS [loginId];
//         EXECUTE master.sys.sp_MSforeachdb 'USE [?];  DB_NAME() as [Db], USER_ID('${name}') AS [userId]';` )
//       .then( (err, recordset) => {
// log.error(err)
// log.confirm(inspect(recordset));
//         return recordset;
//       })
//       .catch( (e) => { throw new Error(`server principal query failure, \n${e}`); });
//
//     },
//
//     setLogin: function(name, password) {
//
//       return db.query(`CREATE LOGIN ${name} WITH PASSWORD = '${password}';`)
//       .then( (response) => `\nlogin '${name}' created \n${response}`)
//       .catch( (e) => { throw new Error(`failed to create SQL Server login '${name}' \n${e}`); });
//
//     },
//
//     setUser : function(username, loginame) {
//
//       return db.query(`CREATE USER [${username}] FROM LOGIN [${loginame}];`)
//       .then( (response) => `user created ${response}`)
//       .catch( (e) => { throw new Error(`failed to create user '${username}' \n${e}`); });
//
//     },
//
//     setPassword : function(loginame, password) {
//
//       return db.query(`ALTER LOGIN [${loginame}] WITH PASSWORD = '${password}' MUST_CHANGE UNLOCK;`)
//       .then( (response) => `user created ${response}`)
//       .catch( (e) => { throw new Error(`failed to create user '${username}' \n${e}`); });
//
//     }
//
//     //may need login() and logout()?
//
//  };

// log.info(`SqlUserInfo(${loginame}):  ${sqlTools.SqlUserInfo(loginame)}`);
//
//   if (!sqlTools.SqlUserInfo(loginame).loginId) {
// log.info(`SqlUserInfo ${sqlTools.SqlUserInfo(loginame)}`);
//     sqlTools.setLogin(loginame);
//
//   }
//
//   if (!sqlTools.SqlUserInfo(username)) {
//
//     sqlTools.setUser(username);
//
//   }c
