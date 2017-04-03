"use strict;"
// NPM
const colors = require('colors');
const mssql = require('mssql');
const prettyjson =  require('prettyjson');
const Promise = require('bluebird');
const watch = require('vantage-watch');
const Vantage = require('vantage');
const vorpalLog = require('vorpal-log');
// core
const childProcess = Promise.promisifyAll(require('child_process'));
const fs = Promise.promisifyAll(require('fs'));
const net = require('net');
const path = require('path');
const inspect = require('util').inspect
// local
const { Switch, Prefix, Batch, BatchHistory } = require(`./cache`);
const config = require(`./config`);
const queries = require(`./queries`);
const ignoreDirs = [];
const ignoreFiles = [];

const splash =`
                  #                                #
          #                  @@       &&&&                 #
      #      @@@@     &&&    @@       &&  &&   @@@@             #
   #        @@   @  &&   &&  @@       &&  &&  @@  @@  &&           #
 :           @@     &&   &&  @@       &&  &&  @@  @@  &&             :
 '         @   @@   &&   &&  @@       &&&&    @@@@@@  &&             '
   #         @@@@   &&   &&  @@       &&      @@  @@  &&&&         #
      #               &\\&    @@       &&      @@  @@            #
          #             \\    @@@@@@   &&                   #
                  #                                 #
`;

const vantage = Vantage();

vantage
 .use( vorpalLog, {printDate: config.printDate})
 .banner( `      ` + colors.inverse(`Vantage CLI for Microsoft's SQL Server on Linux CTP dockerhub image\n` ))
 .listen( process.argv[2] && !Number.isNaN(process.argv[2])? process.argv[2]: config.port )
 .delimiter(`sqlpal@${process.argv[2] && !Number.isNaN(process.argv[2])? process.argv[2]: config.port}~`)
 .show();

vantage.firewall
 .policy('REJECT')
 .accept(config.subnet);

vantage.auth("basic", config.auth);

vantage.toolPouch = {
  compile: function (cacheObject) {
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
      str = cacheObject.join(' ')
    }
    return str;
  },
  formatLocalDate: function () {
     // duckduckgo.search.header.@MattJohnson
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
  },
  getDir: function(parentFolder, filter) {
    return vfs.readdirAsync(parentFolder)
    .then(function(files) {
      let directory = {folders:[], files:[]};
      for (i in files) {

        let stat = vfs.statSync(path.join(vmap.root, vwd, files[i]));
        if (stat && stat.isDirectory()) {

          if (ignoreDirs.indexOf(files[i])==-1) {
            directory.folders.push(files[i]);
          }

        } else {

          if (ignoreFiles.indexOf(files[i])==-1) {
            directory.files.push(files[i]);
          }

        }
      }
      return directory;
    })
    .catch(function (err) {
      log.error("filer.js",
                "\n\tvirtual directory error @ vwd:", $vwd,
                '\n\terror', err);
    });

  },
  getScript: function (scriptFile) {
    // returns the contents of a file in scripts folder
    return fs.readFileAsync(path.join(config.scriptPath, scriptFile), 'utf8')
      .then(function(fileScript) {
        return fileScript;
      })
      .catch((e) => { log.error(e); });
  },
  tsql: function(qry, callback) {
    // disconnect after each qry - use sqlcmd -q for pesistent ad hoc connection
    return mssql.connect({
        user: Switch.U,
        password: Switch.P,
        server: Switch.S,
        database: Switch.d,
        pool: config.odbcPool })
      .then( function (cn) {
        if (!qry) qry=vantage.toolPouch.compile(Batch)
        new mssql.Request(cn).query(qry)
        .then( function(results) {
          callback(results);
        })
        .catch((e) => { log.error(e); });
      })
      .catch((e) => { log.error(e); });
  }
};
// *********** check startup and  *************
let log = vantage.logger;

log.log(colors.rainbow(splash));
log.log(vantage._banner);

log.debug(vantage.toolPouch.formatLocalDate());


vantage.toolPouch.getScript('testQuery.sql')
.then( function(fileScript) {

  vantage.toolPouch.tsql(fileScript, function(results) {
      log.log(prettyjson.render(results[0]));
  });

  vantage.toolPouch.tsql(queries.getVersion, function(results) {

    let mssql = childProcess.execSync("npm view mssql version").toString().trim();
    let sqlcmd = childProcess.execSync("/opt/mssql-tools/bin/sqlcmd | grep Version").toString().trim();
    let bcp = childProcess.execSync("/opt/mssql-tools/bin/bcp -v | grep Version").toString().trim();
    let odbc = childProcess.execSync("ls /opt/microsoft/msodbcsql/lib64").toString().trim();
    let vantage = childProcess.execSync("npm view vantage version").toString().trim();
    let docker = childProcess.execSync("docker -v").toString().trim()

    log.debug(mssql);
    log.debug(sqlcmd);
    log.debug(bcp);
    log.debug(odbc);
    log.debug(vantage);
    log.debug(docker);

    log.log(prettyjson.render(
      [
        results[0],
        {
          mssql,
          sqlcmd,
          bcp,
          odbc,
          vantage,
          docker
        }
      ]
    ));

    log.log(prettyjson.render(
      [ ``,
        `enter T-SQL query line(s) -or- sqlpal commands at the prompt`,
        `T-SQL lines are buffered into a Batch cache object on <enter>`,
        `type 'go' at prompt to send cached Batch to database using mssql`,
        `type 'help' to list the available sqlpal commands `,
        ``
      ]
    ));
    log.setFilter(config.logFilter);

  })
  .catch( function(err) {
    console.error('failed to initiaize sqlpal', err);
    process.exit(1);
  });

});
// ******* end load routine *************

vantage
  .command(`firewall [address[, subnet]]`)
  .description(`Vantage IP Firewall.`)
  .option(`-a, --accept <'add' || 'remove'>`, `Add or Remove an 'ACCEPT' Rule for [assy[, sub]]`)
  .option(`-l, --rules`, `(default) View Active Firewall Configuration`)
  .option(`-p, --policy ['ACCEPT' || 'REJECT']`, `Change Firewall Policy`)
  .option(`-r, --reject <'add' || 'remove'>`, `Add or Remove a 'REJECT' Rule for [assy[, sub]]`)
  .option(`-x, --reset`, `Reset to default Firewall Policy - 'ACCEPT' all`)
  .action(

    function(args, callback) {

      switch (true) {

        case ([/^add$/i, /^remove$/i].includes(args.options.accept) && args.length==1):
          vantage.firewall.accept(address, [subnet]);

        case ([/^add$/i, /^remove$/i].includes(args.options.reject) && args.length==1):
          vantage.firewall.reject(address, [subnet]);
          break;

        case ([/ACCEPT/i, /REJECT/i].includes(args.options.policy)):
          vantage.firewall.policy(args.options.policy);
          break;

        case (args.options.rules):

        default:
          log.log(vantage.firewall.rules());
          break;

      }

      callback();

    });

vantage
  .command(`server ['start'||'stop']`)
  .description(`Docker Contained SQL Server`)
  .option(`-b, --bridge`, `Show Docker Bridge (default)`)
  .option(`-c, --containers`, `List Containers (docker ps -a)`)
  .option(`-d, --docker`, `Start|Stop Docker Daemon`)
  .option(`-i, --instance [ ImageId ]`, `Start|Stop Database Container`)
  .action(

    function(args, callback) {

      if (!args[0] || [/^start$/i, /^stop$/i].includes(args[0])) {

        switch(true) {

          case (args.options.containers):
            log.log(prettyjson.render(childProcess.execSync(`docker ps -a`).toString()));
            break;

          case (args.options.docker):
            log.log(prettyjson.render(childProcess.execSync(`sudo service docker ${args[0]}`).toString()));
            break;

          case (typeof args.options.instance == 'string'):
            log.log(prettyjson.render(childProcess.execSync(`docker ${args[0]} ${args.options.instance}`).toString()));
            break;

          case (typeof args.options.bridge):

          default:
            log.log(prettyjson.render(JSON.parse(childProcess.execSync(`docker network inspect bridge`).toString())));
            break;

        }

      }
      callback();

    });

vantage
  .command(`cache`)
  .alias(`?`)
  .description(`View/Modify cache objects`)
  .option(`-a, --all`, `All cache objects (default - no edita)`)
  .option(`-b, --batch  [ index ]`, `T-SQL Batch Cache`)
  .option(`-c, --compile`, `Display compiled cache object`)
  .option(`-h, --history  [ timestamp ]`, `T-SQL Batch History`)
  .option(`-p, --prefix  [ index ]`, `SET statement prefix statements`)
  .option(`-s, --switch  [ key ]`, `sqlcmd command-line options`)
  .action(

    function(args, callback) {

      switch(true) {

        case (args.options.batch):
          if (typeof args.options.batch=='number') {
            if (Batch.length>args.options.batch) {
              this.log(`Batch[${args.options.batch}] is not defined`)
            } else {
              this.log(`Batch[${args.options.batch}]\n`, Batch[args.options.batch]);
            }
          } else {
            this.log(`Batch\n`, !args.options.compile? Batch: config.compile(Batch));
          }
          break;

        case (args.options.history):
          this.log(BatchHistory);
          break;

        case (args.options.switch):
          this.log(`Switch\n`, !args.options.compile? Switch: config.compile(Switch));
          break;

        case (args.options.prefix):
          this.log(`Prefix\n`, !args.options.compile? Prefix: config.compile(Prefix));
          break;

        case (args.options.all):

        default:

          this.log(`${config.odbcPath}/sqlcmd ` +
            vantage.toolPouch.compile(Switch) +
            `\n[-q | -Q]\n"` +
            vantage.toolPouch.compile(Prefix) +
            vantage.toolPouch.compile(Batch)
            + `"` );
          break;

      }

      if (callback) {
        callback();
      }

    });

vantage
  .command(`list`)
  .description(`List available queries from a category sqlpal stored queries`)
  .option(`-b, --batches`, `BatchHistory cache`)
  .option(`-q, --queries`, `queries object`)
  .option(`-s, --scripts`, `//Scripts// folder files`)
  .action(

    function(args, callback) {

      switch(true) {

        case (args.options.batches):
          Object.keys(BatchHistory).forEach(function(timestamp) {
            log.log(BatchHistory);
          });
          break;

        case (args.options.queries):
          log.log(Object.keys(queries));
          break;

        case (args.options.scripts):
          return fs.readdirAsync(scripts)
          .then( (results) => { config.dir(results); })
          .catch((e) => { throw(e); });
          break;

        default:
          log.warn('Please specify a cache object to list.');
          log.info(`Type 'help list' for available `);
          break;

      }

      callback();

    });

vantage
  .command(`bcp`)
  .description(`Bulk Copy Data file`)
  .option(`-i, --input [data-file]`, `submit script file, return results and close connection`)
  .option(`-o, --output [data-file]`, `result output file (default stdout)`)
  .action(
     function(args, callback){
        log.warn('yet to be implemented');
        //   let slog= this.parent.logger;
        //   // return this.prompt({
        //   //   type: 'confirm',
        //   //   name: 'continue',
        //   //   default: false,
        //   //   message: 'That sounds like a really bad idea. Continue?',
        //   // }, function(result){
        //   //   if (!result.continue) {
        //   //     log.info('Good move.');
        //   //     cb();
        //   //   } else {
        //   //     log.warn('Fine. You\'re on your own pal.');
        //   //   }
        //   // });
        //
        //   let cmd;
        //
        //   if (args.options.input) {
        //     cmd = ` -i '${args.script}'`;
        //   }
        //
        //   if (args.options.output) {
        //     cmd = ` -o '${args.script}'`;
        //   }
        //
        // return childProcess.execAsync(`${path.join(config.odbcPath,'sqlcmd')} ${vantage.toolPouch.compile(Switch)} ${cmd}`)
        // .then((results)=>results)
        // .catch((e)=>slog.error(e));

       callback();

    });


vantage
  .command(`sqlcmd`)
  .description(`Submit Batch cache content via sqlcmd`)
  .option(`-A, --dac`, `Dedicated Admin Connection`)
  .option(`-e, --exec`, `Like -Query except Batch is isolated within sp_executesql() context`)
  .option(`-Q, --Query`, `Execute Batch, return results and close connection`)
  .option(`-q, --query`, `Execute optional Batch and Wait at sqlcmd prompt input`)
  .option(`-i, --input <script-file>`, `submit script file, return results and close connection`)
  .option(`-o, --output <file-name>`, `result output file (default stdout)`)
  .action(
    function(args, callback){

      let pfx=vantage.toolPouch.compile(Prefix);
      let sw=vantage.toolPouch.compile(Switch);
      let bat=vantage.toolPouch.compile(Batch);
      let slog= this.parent.logger;
      let qry;

      let spawnArgs = [];
      Object.keys(Switch).forEach((key) => {
          spawnArgs.push(`-${key}`);
          if (Switch[key]!=key) {
            spawnArgs.push(Switch[key])
          }
      });
      switch(true) {

        case (args.options.input) :
          spawnArgs.push(`-i`)
          spawnArgs.push(args.script);
          break;

        case (args.options.atomic) :
          //qry = ` -Q '${pfx} exec sp_executesq('${bat}')`;
          spawnArgs.push(`-Q`)
          spawnArgs.push(`${pfx} exec sp_executesq('${bat}')`);
          break;

        case (args.options.Query) :
          //qry = ` -Q "${pfx} ${bat}"`;
          spawnArgs.push(`-Q`)
          spawnArgs.push(`${pfx} ${bat}`)
          break;

        case (args.options.dac) :
          spawnArgs.concat([`-A`, `-d`, `master`]);
          break;

        case (args.options.query) :
          // falls through
        default:
          spawnArgs.push(`-q`);
          if (pfx.length>0) {
            spawnArgs.push(pfx);
          }
          break;

      }

      log.log(`type 'exit' at sqlcmd prompt to close sqlcmd and resume sqlpal`)
      let child = childProcess.spawn(path.join(config.odbcPath, `sqlcmd`), spawnArgs, {
        stdio: ['inherit', 'inherit', 'inherit']
      });

      child.on('close', (code) => {
        if (!code==0) {
          log.log(`child process exited with code ${code}`);
        }
        callback();
      });

    });

vantage
  .command(`sqlog [ext]`)
  .description(`SQL Server errorlog,`)
  .option(`-h, --head [[-]K]`, `first 'K' lines or up to '-K' (default first 10)`)
  .option(`-l, --list`, `available log files`)
  .option(`-t, --tail [[+]K]`, `last 'K' lines or from '+K' (default last 10)`)
  .action(

    function(args, callback) {

      log.debug(args.ext);
      // [debug] { options: {}, extension: 1 }
      log.debug(`type: ${typeof args.ext} extension: ${typeof args.ext=='undefined'? '': '.' + args.ext}`);
      // [debug] extension 1

      let errorlog = path.join(config.sqlPath, `log/errorlog${typeof args.ext=='undefined'? '': '.' + args.ext}`);
      log.debug(`errorlog ${errorlog}`);
// [debug] errorlog /var/opt/mssql/log/errorlog
      // always using sudo to protect from desktop walk-by style attacks
      // explicit magnitude (+-) on 'number of lines' positions reader
      switch (true) {

        case (['boolean', 'number'].includes(typeof args.options.head)) :
          log.debug(args.options.head || typeof args.options.head=='number');
          log.debug(typeof args.options.head=='number'? args.options.head: 10);
          // head -n K is the number of lines, head -n -K is beginning to line# K
          shellscript = `sudo head ${errorlog} -n ${typeof args.options.head=='number'? args.options.head: 10}`;
          break;

        case (args.options.list) :
          log.debug(args.options);
          shellscript = `sudo ls /var/opt/mssql/log/| grep errorlog`;
          break;

        case (['boolean', 'number'].includes(typeof args.options.tail)) :
          log.debug(args.options.tail || typeof args.options.tail=='number');
          // tail -n K is the number of lines, head -n +K is from line# K to end
          shellscript = `sudo tail ${errorlog} -n ${typeof args.options.tail=='number'? args.options.tail: 10}`;
          break;

        default :
          log.debug(args);
          // Always numbers the output lines
          shellscript = `sudo cat ${errorlog} -n`;
          break;
      }

      log.debug(shellscript);
      log.log(prettyjson.render([childProcess.execSync(shellscript).toString()]));

      // don't get the prompt back if the empty callback is not called
      callback();

    });

vantage
  .catch('[tsql...]')
  .action(
    function(args, callback) {

      let writer = function(results) {
        results.forEach( function(result) {
          log.log(prettyjson.render([result]));
        });
      };

      let newline = args.tsql.join(' ');

      switch (true) {

        // case (/^batch \s ./i.test(newline)) :
        //
        //     break;
        //
        // case (/^queries\./i.test(newline)) :
        //   vantage.toolPouch.tsql(queries[newline], (results) => {
        //     writer(results);
        //   });
        //
        //   break;
        //
        // case (/^scripts\s\w+\.sql/i.test(newline)) :
        //
        //   vantage.toolPouch.tsql(
        //     vantage.toolPouch.getScript(newline.split(' ')[1]), (results) => {
        //       writer(results);
        //     });
        //
        //     break;
        //
        case (/^GO$/i.test(newline)) :

          let goTime=vantage.toolPouch.formatLocalDate();

          vantage.toolPouch.tsql(vantage.toolPouch.compile(Batch), (results) => {
            writer(results);
            // results.forEach( function(result) {
            //   log.log(prettyjson.render([result]));
            // });
            BatchHistory[goTime] = JSON.stringify(Batch);
            Batch.splice(0);
          });

          break;

        default:

          Batch.push(newline);

          break;
      }

    callback();

  });

module.exports = vantage;
