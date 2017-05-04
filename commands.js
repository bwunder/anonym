//// vantage CLI+SSL
const Promise = require('bluebird');
const watch = require('vantage-watch');
const Vantage = require('vantage');
const vorpalLog = require('vorpal-log');

const colors = require('colors');
const prettyjson =  require('prettyjson');

//// node.js core
const childProcess = Promise.promisifyAll(require('child_process'));
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');

const config = require(`./config.json`);
const tools = require('./tools');
const queries = require(`./queries`);

//// cache
const Batch = config.cache.Batch;
const BatchHistory = config.cache.BatchHistory;
const Prefix = config.cache.Prefix;
const Switch = config.cache.Switch;

// would args be better? an option? something! ANYTHING!!
Switch.U = config.sql.sa.name;
Switch.P = config.sql.sa.password;

const vantage = new Vantage();

const port = process.argv[2] && !Number.isNaN(process.argv[2])? process.argv[2]: config.vantage.port;

// nothing
vantage.auth(config.vantage.middleware, config.vantage.auth.users);

vantage
  .use( vorpalLog, {printDate: config.printDate})
  .banner(tools.bandaid)
  .listen(port)
  .delimiter(`sqlpal@${config.vantage.port}~`)
  .show();

  //  .listen({
  //    port: port,
  //    ssl: true,
  //    key: fs.readFileSync('./../../server.key'),
  //    cert: fs.readFileSync('./../../server.crt'),
  //    ca: fs.readFileSync('./../../ca.crt'),
  //    requestCert: true,
  //    rejectUnauthorized: false
  //  })

const log = vantage.logger;
vantage.logger.setFilter(config.vantage.loglevel);

vantage.firewall.policy(config.vantage.firewall.policy);

config.vantage.firewall.rules.forEach( function(rule) {

  switch (true) {

    case (/^accept$/i.test(rule.rule)):

      vantage.firewall.accept( `${rule.ip}/${rule.subnet}`);

      break;

    case (/^reject$/i.test(rule.rule)):

      vantage.firewall.reject( `${rule.ip}/${rule.subnet}`);

      break;

    default:

      log.warn(`ignoring firewall rule:\n\t${JSON.stringify(rule)}`)

      break;

  }

});

vantage.command(`config`, `Review Configurations`)
  .option(`-a, --app`, path.resolve(__dirname, 'config.json'))
  .option(`-m, --mssql`, path.resolve(config.docker.sqlVolume, 'mssql.conf'))
  .option(`-s, --sqlserver [ 'option-name' ]`, `sys.configurations`)
  .action( (args, callback) => {

    log.debug(JSON.stringify(args));

    switch(true) {

      case (args.options.mssql):

        return fs.readFileAsync(path.resolve(config.docker.sqlVolume, 'mssql.conf'))
        .then((fileBuffer) => {
          log.log(tools.gigo(fileBuffer.toString()));
          log.info([`This file reflects SQL Server start-up configation options. Do not edit the file.`,
            `Use the mssql-conf utility shipped with SQL Server to change or to stop/start the SQL Server.`,
            `To Open the utility, type 'SERVER -s' then type 'MSSQL-CONF' at the prompt that follows.`].join('\n'));
        })
        .catch((err) => {
          log.error(err.message);
          log.debug(err.stack);
        });

        break;

      case (args.options.sqlserver):

        pool.request().query(queries.getConfigurations).then( results => {

          log.log(tools.gigo(results.recordsets));
          log.info(`To see one, include first characters of name to uniquely identitfy, (quote if spaces)`);

        });

        break;

      case (typeof args.options.sqlserver=='string'):

        pool.request().query(`EXEC sp_configure '${args.options.sqlserver}'`).then( results => {

          results.recordset[0].name
          log.log(tools.gigo(results.recordset));
          log.info([`T-SQL to change:`,
            `\tEXEC sp_configure '${results.recordset[0].name}', <new-value>;`,
            `\tRECONFIGURE [WITH OVERRIDE];`].join('\n'));

        });

        break;

      case (args.options.app):

      default:

        return fs.readFileAsync(path.resolve(__dirname, 'config.json'))
        .then((fileBuffer) => {
          log.log(tools.gigo(JSON.parse(fileBuffer.toString())));
          log.info(`To change, edit file '${path.resolve(process.cwd(), 'config.json')}`);

        })
        .catch((err) => {
          log.error(err.message)
          log.debug(err.stack);
        });

        break;

    }

    callback();

});

vantage.command(`server`)
  .alias('ds')
  .description(`Manage Docker Contained Data Server`)
  .option(`-c, --container [ RESTART | START | STOP ]`, `instance of image`)
  .option(`-d, --docker [ START | STOP ]`, `Container Engine`)
  .option(`-i, --image [ RUN ]`, `Local SQL Server Image`)
  .option(`-n, --network`, `Docker Network Bridge`)
  .option(`-p, --pull`, `Get Latest SQL Image from dockerhub.com`)
  .option(`-s, --shell`, `bash command prompt inside the container`)
  .action( (args, callback) => {

    try {

      let cmd='';
      log.debug(JSON.stringify(args));

      switch(true) {

        case (args.options.container):

          cmd = `docker ps -a --filter "ancestor=${config.docker.image}"`;

          break;

        case (typeof args.options.container=='string'):

          switch(args.options.container) {

            case ('list'):

              cmd = `docker ps -a`;

              break;

            case ('restart'):

            case ('start'):

            case ('stop'):

              cmd = `docker container ${args.options.container} ${vantage.containerId}`;

              break;

            default:

              break;


          }
          if (['start', 'stop', 'restart'].includes(args.options.container.toLowerCase())) {


          } else {

            log.warn('nothing to do...');

          }

          break;

        case (args.options.docker):

          cmd = `sudo service docker status`;

          break;

        case (typeof args.options.docker=='string'):

          if (['start', 'stop'].includes(args.options.docker.toLowerCase())) {

            cmd = `sudo service docker ${args.options.docker}`;

            if ('start'==args.options.docker.toLowerCase()) {
              vantage.exec('server -c start');
            }

          } else {

            log.warn('no-op');

          }

          break;

        case (args.options.image):

          cmd = `docker images -a ${config.docker.image}`;

          break;

        case (typeof args.options.image=='string'):

          if ('run'==args.options.docker.toLowerCase()) {

            cmd = [`sudo docker run`,
                   `-e "ACCEPT_EULA=${config.sql.acceptEULA}"`,
                   `-e "SA_PASSWORD=${config.sql.sa.password}"`,
                   `-p ${config.docker.hostPort}:${config.docker.sqlPort}`,
                   `-v ${config.docker.sqlVolume}:${config.docker.sqlVolume}`,
                   `-d ${vantage.imageId}`].join(' ');

          } else {

            log.warn('no-op');

          }

          break;

        case (args.options.network):

          cmd=`docker network inspect bridge`;

          break;

        case (args.options.pull):

          childProcess.exec(`sudo docker pull ${config.docker.image}`, function(results) {
            log.info('new image downloaded')
          });

          break;

        case (args.options.shell):

          if (!vantage.containerId) {

            log.warn('Unknown Container-Id: PULL and RUN SQL Server image')

          } else {

            log.info([`Commands 'bcp, 'mssql-conf' and 'sqlcmd' are available at this prompt`,
              `type 'mssql-conf', 'sqlcmd' or 'bcp' with no args for usage information`,
              `sqlcmd-or-bcp -Usa -P '$SA_PASSWORD' ... gets password from container\'s environment`,
              `type 'exit' to close bash in container and revert to sqlpal CLI`].join('\n'));

            // (re)set links disconnected
            childProcess.execSync(`docker exec -d ${vantage.containerId} /bin/bash`);
            childProcess.execSync(`docker exec -d ${vantage.containerId} ln -sf ${config.odbc.path}/sqlcmd /usr/bin`);
            childProcess.execSync(`docker exec -d ${vantage.containerId} ln -sf ${config.odbc.path}/bcp /usr/bin`);
            childProcess.execSync(`docker exec -d ${vantage.containerId} ln -sf -T ${config.sql.conf} /usr/bin/mssql-conf`);
            // open interactive
            let child = childProcess.spawnSync(`docker`, [`exec`, `-it`, `${vantage.containerId}`, `/bin/bash`], {
              stdio: ['inherit', 'inherit', 'inherit']
            });

          }

          break;

        default:

          cmd=`docker info`;

          break;

      }

      if (cmd) {
        log.log(tools.gigo(childProcess.execSync(cmd)));
      }


      callback();

    }
    catch(e) {

      log.error(e.message);
      log.debug(e.stack);

    }

  });

vantage.command(`list`, `List Various Administrative Collections`)
  .alias('ls')
  .option(`-b, --backups`, `SQL Server Database backups files`)
  .option(`-c, --coredumps`, `SQL Server Stack Dump files`)
  .option(`-d, --data`, `SQL Server Database Data files`)
  .option(`-l, --log`, `SQL Server Database Log files`)
  .option(`-r, --reader`, `CLI T-SQL Line Reader keywords`)
  .option(`-s, --session`, `Session command line history`)
  .option(`-v, --vorpal`, `vorpal CLI commands`)
  .action( (args, callback) => {

    try {

      log.debug(JSON.stringify(args));

      switch(true) {

        case (args.options.backups):

          return fs.readdirAsync(path.resolve(__dirname, config.sql.backup.path))
          .then((files) => {
            log.info(`Backup Path: ${path.resolve(__dirname, config.sql.backup.path)}`);
            files.forEach( function(file) {
              if (path.extname(file)==config.sql.backup.extension) {
                log.log(tools.gigo(file));
              }
            });
          })
          .catch((err) => {
            log.error(err.message);
            log.debug(err.stack);
          });

          break;

          case (args.options.coredumps):

            return fs.readdirAsync(path.resolve(__dirname, config.sql.dump.path))
            .then((files) => {
              log.info(`Dump Path: ${path.resolve(__dirname, config.sql.dump.path)}`);
              files.forEach( function(file) {
                if (file.startsWith('core')) {
                  log.log(tools.gigo(file));
                }
              });
            })
            .catch((err) => {
              log.error(err.message);
              log.debug(err.stack);
            });

            break;

          case (args.options.data):

            return fs.readdirAsync(path.resolve(__dirname, config.sql.data.path))
            .then((files) => {
              log.info(`Data Path: ${path.resolve(__dirname, config.sql.data.path)}`);
              files.forEach( function(file) {
                if (path.extname(file)=='.mdf') {
                  log.log(tools.gigo(file));
                }
              });
            })
            .catch((err) => {
              log.error(err.message);
              log.debug(err.stack);
            });

            break;

          case (args.options.log):

            return fs.readdirAsync(path.resolve(__dirname, config.sql.log.path))
            .then((files) => {
              log.info(`Log Path: ${path.resolve(__dirname, config.sql.log.path)}`);
              files.forEach( function(file) {
                if (path.extname(file)=='.ldf') {
                  log.log(tools.gigo(file));
                }
              });
            })
            .catch((err) => {
              log.error(err.message);
              log.debug(err.stack);
            });

            break;

        case (args.options.reader):

          let names=[];
          vantage.commands.forEach( (command) => {
            if (command._name) {
              names.push(command._name);
            }
          });

          log.info(tools.commandAid(names));

          break;

        case (args.options.session):

          log.log(tools.gigo(vantage.session._hist.join('\n')));

          break;

        case (args.options.vorpal):

          let cmds = vantage.commands;
          Object.keys(cmds).forEach( function(i) {
            let results = {};
            results[`${cmds[i]._name}`] = `${cmds[i]._description}`;
            if (cmds[i].options.length>0 && typeof cmds[i]._description!='undefined') {
              for (opt in cmds[i].options) {
                results[`  ${cmds[i].options[opt].flags}`] = `${cmds[i].options[opt].description}`;
              }
            }
            log.log(tools.gigo(results));
          });

          break;

        default:

          vantage.exec(`help list`);

          break;
      }

      log.debug('listing complete');


      callback();

    }
    catch(e) {

      log.error(e.message);
      log.debug(e.stack);

    }

  });

vantage.command(`cache`, `Cache objects`)
  .alias(`?`)
  .option(`-b, --batch [ clear ]`, `T-SQL Batch Cache (default)`)
  .option(`-c, --compile [ sqlcmd | bcp | query | batch ]`, `Compile cached command`)
  .option(`-k, --key [ BatchHistory-key ]`, `T-SQL Batch History`)
  .option(`-p, --prefix`, `SET Statement(s) prefix`)
  .option(`-s, --switch  [ key ]`, `Database Connection Options`)
  .option(`-v, --vorpal`, `Vorpal Session command-line History`)
  .action( (args, callback) => {

    try {

      let result='';
      log.debug(JSON.stringify(args));

      switch(true) {

        case (typeof args.options.compile!='undefined'):

          switch (true) {

            case (/^sqlcmd$/i.test(args.options.compile)):

              result=`${config.odbc.path}/sqlcmd\n` +
                tools.compile(Switch) +
                `\n[-q | -Q]\n"` +
                tools.compile(Prefix) + '\n' +
                tools.compile(Batch)
                + `"`;

              break;

            case (/^bcp$/i.test(args.options.compile)):

                result=`${config.odbc.path}/bcp ` + 'WHAT & HOW TO COMPILE?' +
                  `\n[ -i  data-file | -o  new-file ]\n"`;

              break;

            case (/^query$/i.test(args.options.compile)):

              result=tools.compile([`pool.Request{`,
                `  user: ${Switch.U}`,
                `  password: ${Switch.P}`,
                `  server: ${Switch.S}`,
                `  database: ${Switch.d}`,
                `  pool: ${config.odbc.pool} })`,
                `.query("${tools.compile(Batch)}");`]);

            break;

            case (/^batch$/i.test(args.options.compile)):

              result=tools.compile([`pool.Request{`,
                `  user: ${Switch.U}`,
                `  password: ${Switch.P}`,
                `  server: ${Switch.S}`,
                `  database: ${Switch.d}`,
                `  pool: ${config.odbc.pool} })`,
                `.batch("${tools.compile(Batch)}");`]);

              break;

            default:

              result='';
              vantage.exec(`help cache`);

              break;
          }

          break;

        case (args.options.history):

            result=BatchHistory;

          break;

        case (typeof args.options.history):

          result= vorpal.history;

          break;

        case (args.options.switch):

          result=Switch;

          break;

        case (typeof args.options.switch=='string'):

          result=Switch[args.options.switch];

          break;

        case (args.options.prefix):

          result=Prefix;

          break;

        case (typeof args.options.vorpal):

          vorpal.history();

        case (typeof args.options.batch!='undefined'):

          if (args.options.batch=='clear') {
            Batch.splice(0);
            result=`Batch cleared`;
          }

        default:

          result=tools.compile(Batch);

          break;

      }

      log.debug('cache operation complete');
      log.log(tools.gigo(result));

      callback();

    }
    catch(e) {

        log.error(e.message);
        log.debug(e.stack);
    }

  });


vantage.command(`bcp`, `Bulk Copy Data file`)
  .option(`-i, --input [data-file]`, `submit script file, return results and close connection`)
  .option(`-o, --output [data-file]`, `result output file (default stdout)`)
  .action( (args, callback) => {

    try {

      log.debug(JSON.stringify(args));

      log.debug('nothing in the bcp command factory yet...');


      callback();

    }
    catch(e) {

        log.error(e.message);
        log.debug(e.stack);

    }

  });

vantage.command(`sqlcmd`, `Process a Batch, query or script with sqlcmd (warning: call is blocking)`)
  .option(`-e, --executesql`, `Process Batch in isolation from Prefix settings`)
  .option(`-i, --input [ script-file ]`, `submit a script-file and render in sqlpal`)
  .option(`-Q, --Query`, `Process the Batch with configured Prefix and render in sqlpal`)
  .option(`-q, --query`, `Process the Batch, render, then wait in sqlcmd session for input`)
  .option(`-o, --output [ data-file ]`, `direct result to a file on sqlpal host`)
  .action( (args, callback) => {

    try {

      let child;

      let spawnArgs = [];
      Object.keys(Switch).forEach((key) => {
          spawnArgs.push(`-${key}`);
          if (Switch[key]!=key) {
            spawnArgs.push(Switch[key])
          }
      });

      switch(true) {

        case (args.options.executesql) :

          spawnArgs.push(`-Q`)
          spawnArgs.push(`${tools.compile(Prefix)} exec sp_executesq('${tools.compile(Batch)}')`);
          log.debug(`sqlcmd executesql ${JSON.stringify(spawnArgs)}`);

          break;

        case (typeof args.options.input=='string') :

          spawnArgs.push(`-i`)
          spawnArgs.push(args.options.input);
          log.debug(`sqlcmd input ${JSON.stringify(spawnArgs)}`);

          break;

        case (args.options.Query) :

          spawnArgs.push(`-Q`)
          spawnArgs.push(`${tools.compile(Prefix)} ${tools.compile(Batch)}`)
          log.debug(`sqlcmd Query ${JSON.stringify(spawnArgs)}`);

          break;

        case (args.options.query) :

        default:

          spawnArgs.push(`-q`);
          if (Prefix.length>0) {
            spawnArgs.push(`${tools.compile(Prefix)} ${tools.compile(Batch)}`);
          }

          log.warn(`blocks until user types 'exit' at sqlcmd prompt or connection times out.`);

          child = childProcess.spawnSync(path.resolve(config.odbc.path, 'sqlcmd'), spawnArgs, {
            stdio: ['inherit', 'inherit', 'inherit']
          });

          break;

      }

      if (typeof args.options.output=='string') {

        spawnArgs.push(`-o`)
        spawnArgs.push(args.options.output);

      }

      if (!child) {

        child = childProcess.spawn(path.resolve(config.odbc.path, 'sqlcmd'), spawnArgs, {
          stdio: ['inherit', 'inherit', 'inherit']
        });

        child.on('close', (code) => {
          if (!code==0) {
            log.warn(tools.gigo(`sqlcmd exited with code ${code}`));
          }
        });

      }

      BatchHistory[Object.keys(BatchHistory).length] = Batch;
      Batch.splice(0);

      log.debug('sqlcmd complete')


      callback();

    }
    catch(e) {

      log.error(e.message);
      log.debug(e.stack);

    }

  });

vantage.command(`sqlog [ext]`, `SQL Server errorlog (default: active log)`)
  .alias(`errorlog`)
  .option(`-h, --head [[-]K]`, `first 'K' lines or up to '-K' (default: first 10)`)
  .option(`-l, --list`, `available log files at ${config.sql.log.path}`)
  .option(`-t, --tail [[+]K]`, `last 'K' lines or from '+K' (default: last 10)`)
  .action( (args, callback) => {

    try {

      log.debug(JSON.stringify(args));
      let ename = `errorlog${typeof args.ext=='undefined'? '': '.' + args.ext}`
      let elog = path.resolve(config.sql.log.path, ename);

      switch (true) {

        case (['boolean', 'number'].includes(typeof args.options.head)) :

          // head -n K is the number of lines, head -n -K is beginning to line# K
          shellscript = `head ${elog} -n ${typeof args.options.head=='number'? args.options.head: 10}`;

          break;

        case (args.options.list) :

          shellscript = `ls ${elog}| grep elog`;

          break;

        case (['boolean', 'number'].includes(typeof args.options.tail)) :

          // tail -n K is the number of lines, head -n +K is from line# K to end
          shellscript = `tail ${elog} -n ${typeof args.options.tail=='number'? args.options.tail: 10}`;

          break;

        default :

          // Always numbers the output lines
          shellscript = `cat ${elog} -n`;

          break;

      }

      log.debug(shellscript);
      log.warn(`Persistent SQL Server volume on '${process.env["HOST"]}'`);
      log.info(`If no persisted volume, use 'SERVER -s'; see ${config.sql.log.path} once in shell`);
      log.log(tools.gigo([childProcess.execSync(`sudo ${shellscript}`).toString()]));


      callback();

    }
    catch(e) {

      log.error(e.message);
      log.debug(e.stack);

    }

  });

vantage.catch('[tsql...]')
  .action( (args, callback) => {

    try {

      let goTime = new Date;

      let newline = args.tsql.join(' ');

      switch (true) {

        case (/^GO$/i.test(newline)) :
          pool.request().query(tools.compile([`SET NOEXEC ON;`].concat(Batch)))
          .then(
            (err)=> {
              pool.request().query(tools.compile(Batch)).then( (results) => {
                if (results.rowsAffected==0) {
                  log.log(tools.gigo(results));
                } else {
                  results.recordsets.forEach(function(rs) {
                    log.log(tools.gigo(rs));
                    BatchHistory[goTime] = Batch;
                    Batch.splice(0);
                  });
                }
              });
          })
          .catch( (err) => {
            log.warn(err.message);
            log.debug(err.stack);
          });

          break;

        case (/^HISTORY\s\w+$/i.test(newline)) :

          if (BatchHistory[newline.split(' ')[1]]) {

            pool.request().query(tools.compile(BatchHistory[newline.split(' ')[1]])).then( results => {

              results.recordsets.forEach(function(rs) {
                log.log(tools.gigo(rs));
              });

            });

          } else {
            log.warn(`Batch ${newline.split(' ')[1]} not found in BatchHistory`)
          }

          break;

        case (/^QUERY$/i.test(newline)) :

          log.log(tools.gigo(Object.keys(queries).join('\n')));

          break;

        case (/^QUERY\s\w+$/i.test(newline)) :

          let key = newline.split(' ')[1];
          if (queries[key]) {
            let script = queries[key]
            Batch.splice(0);
            Batch.push(`-- ${newline}`);
            if (typeof script=='string') {
              script.split('\n').forEach( function(line) {
                Batch.push(line);
              });
              vantage.exec('?');
            }
          } else {
            log.warn(`unknown query ${key}`);
          }

          break;

        case (/^RUN$/i.test(newline)) :

          pool.request().query(tools.compile([`SET NOEXEC ON;`].concat(Batch)))
          .then(
            (err)=> {
              pool.request().batch(tools.compile(Batch)).then( (results) => {
                if (results.rowsAffected==0) {
                  log.log(tools.gigo(results));
                } else {
                  results.recordsets.forEach(function(rs) {
                    log.log(tools.gigo(rs));
                    BatchHistory[goTime] = Batch;
                    Batch.splice(0);
                  });
                }
              });
            })
            .catch( (err) => {
              log.warn(err.message);
              log.debug(err.stack);
            });

            break;

        case (/^SCRIPT$/i.test(newline)) :

          return fs.readdirAsync(path.resolve(__dirname, config.scriptPath))
          .then((scripts) => {
            log.log(tools.gigo(scripts.join('\n')));
          })
          .catch((err) => {
            log.error(err.message);
            log.debug(err.stack);
          });

          break;

        case (/^SCRIPT\s\w+\.sql$/i.test(newline)) :

          return fs.readFileAsync(path.resolve(__dirname, config.scriptPath, newline.split(' ')[1]), 'utf8')
          .then((script) => {

            if (typeof script=='string') {
              Batch.splice(0);
              Batch.push(`-- ${newline}`);
              script.split('\n').forEach( function(qline) {
                Batch.push(qline);
              });
              vantage.exec('?');
            }
          })
          .catch((err) => {
            log.error(err.message);
            log.debug(err.stack);
          });

          break;

        case (/^TEST$/i.test(newline)) :

          pool.request().query(tools.compile([`SET NOEXEC ON;`].concat(Batch)))
          .then( () => {
            log.log('OK');
          })
          .catch( (err) => {
            log.warn(err.message);
            log.debug(err.stack);
          });

          break;

        default:

          Batch.push(newline);

          break;
      }

      log.debug('catch complete');

      callback();

    }
    catch(err) {

      log.error(err.message);
      log.debug(err.stack);

    }

  });

module.exports = exports = vantage;
