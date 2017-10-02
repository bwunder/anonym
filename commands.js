const pem = require('pem');
const Promise = require('bluebird');
const Vantage = require('vantage');
//const watch = require('vantage-watch');
const vorpalLog = require('vorpal-log');

//// core
const childProcess = Promise.promisifyAll(require('child_process'));
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
//// local
const config = require(`./config.json`);
const sqldb = require('./sqldb');

const lib = require('./lib');
const queryStore = require('./queryStore');

const Batch = config.cache.batch;

var line = '';

pem.createCertificate(config.pem, function(err, keys){

  // feed these ssl creds to sqlpad
console.log('key-path', config.sqlpad[`key-path`]);
  fs.writeFileSync(config.sqlpad[`key-path`], keys.serviceKey);
  fs.writeFileSync(config.sqlpad[`cert-path`], keys.certificate);

  var express = require('express');

  var vantage = new Vantage();
  var app = express();

  vantage
    .use( vorpalLog, { printDate: config.printDate } )
    .banner( lib.bandAid )
    .listen(app, {
      port: config.vantage.port,
      ssl: true,
      key: keys.serviceKey,
      cert: keys.certificate,
      requestCert: true,
      rejectUnauthorized: true,
      logActivity: true },
      (socket) => { this.log(`socket connected: ${socket.id}`);
    })
    .delimiter( `sql`.rainbow + `pal`.america + `@${config.vantage.port}~` )
    .show();

  vantage.auth( config.vantage.middleware, config.vantage.auth );

  vantage.logger.setFilter(config.vantage.loglevel);
  //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  // globalize the log instance
  let log = vantage.logger;
  log.log(vantage._banner);
  config.log=log;
  //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  lib.setInstance();
  vantage.on('client_command_error', (err) => {
    log.warn('vantage client-side command error')
    log.error(err.message);
    log.debug(err.stack);
  })

  vantage.on('server_command_error', (err) => {
    log.warn('vantage server-side command error')
    log.error(err.message);
    log.debug(err.stack);
  })

  // JSONiforncated - padding and quotes stripped from raw input as it is coersed to args array
  vantage.on('client_prompt_submit', (data) => {
    log.debug(`keys logged: ${data}`);
    line = data;
  });

  vantage.command(`config`, `Inspect and adjust component configurations.`)
  .option(`-a, --app  [runtime]`, `${path.resolve(__dirname, 'config.json')}`)
  .option(`-f, --firewall`, `vantage simple IP firewall`)
  .option(`-m, --mssql`, path.resolve(config.docker.sqlVolume, 'mssql.conf'))
  .option(`-s, --sqlserver ['option-name']`, `sys.configurations`)
  .action( (args, callback) => {

    log.debug(`config ${lib.format(args.options)}`);

    switch(true) {

      case (args.options.app==='runtime'):

        lib.log('log', lib.format(config));
        break;

      case (args.options.mssql===true):

        lib.interactiveSession(config.docker.containerId);
        break;

      case (args.options.firewall===true):

        // default policy can be /^ACCEPT$/i or /^REJECT$/i
        vantage.firewall.policy(config.vantage.firewall.policy);
        // explict IPv4 rules (e.g., localhost and local subneting)
        config.vantage.firewall.rules.forEach( function(rule) {
          // validate the rule ip - v4 or v6? https://jsfiddle.net/AJEzQ/
          if ( /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/.test(rule.ip)){

            // build firewall (tested w/IPv4 rules only)
            switch (true) {

              case (/^accept$/i.test(rule.rule)):
                vantage.firewall.accept(`${rule.ip}/${rule.subnet}`);
                break;

              case (/^reject$/i.test(rule.rule)):
                vantage.firewall.reject(`${rule.ip}/${rule.subnet}`);
                break;

              default:
                log.warn(`ignoring firewall rule:\n\t${JSON.stringify(rule)}`)
                break;

            }

          }  // other end of if with 1000 character regex

        });
        break;

      case (args.options.sqlserver===true):

        queryStore.getScript(`configurations`, (script) => {
          sqldb.query(script)
          .then( (results) => {
            lib.log(lib.format(results));
          })
          .catch( (err) => {
            lib.log('warn', `error reading sys.configurations`);
            lib.log('error', err.message);
            lib.log('debug', err.stack);
          });
        });
        break;

      case (typeof args.options.sqlserver==='string'):

        sqldb.query(`EXEC sp_configure '${args.options.sqlserver}'`);
        break;

      case (args.options.app):

      default:

        lib.fileToJSON('config.json');
        break;

    }

    callback();

  });

  vantage.command(`engine`, `Docker Host Container Engine.`)
  .option(`--status`, `Report of Current Status`)
  .option(`-s, --start`, `Start Container Engine`)
  .option(`-x, --stop`, `Stop Container Engine`)
  .action( (args, callback) => {

    log.debug(`engine ${lib.format(args)}`);
    let action = Object.keys(args.options)[0] || `status`;
    // password entry is flakey if async
    // could do a quick sudo query first then tailgate that challenge
//    childProcess.spawnSync(`sudo`);
    log.debug(`(spawnSync) sudo service docker ${action}`);
    childProcess.spawnSync(`sudo`, [ `service`, `docker`, action ], {
      stdio: [null, 1, 2]
    });

    if (Object.keys(args.options)[0]==='start') {
      lib.setInstance();
    }

    callback();

  });

  vantage.command(`image`, `Manage the SQL Server for Linux Docker image.`)
  .option(`-a, --all`, `Local SQL Server images`)
  .option(`-f, --full`, `Configured SQL Server image details`)
  .option(`-i, --id`, `SQL Server\'s Docker image ID`)
  .option(`-p, --pull`, `Download the latest image`)
  .option(`-r, --run [local-image-id]`, `create and execute new container instance`)
  .action( (args, callback) => {

    log.debug(`image ${lib.format(args)}`);
    try {

      let cmd='';
      switch (true) {

        case (args.options.all):

          log.debug(`(execSync) docker image ls ${config.docker.repo}`);
          log.log(lib.format(childProcess.execSync(`docker image ls ${config.docker.repo}`)));

          break;

        case (args.options.full):

          log.debug(`(execSync) docker images ls ${config.docker.repo} | grep ${config.docker.imageId}`)
          log.log(lib.format(childProcess.execSync(`docker image ls ${config.docker.repo} | grep ${config.docker.imageId}`)));

          break;

        case (args.options.id):

          lib.setImage();
          log.log(config.docker.imageId);

          break;

        case (args.options.pull):

          config.docker.imageId='';
          lib.setImage();

          break;

        case (typeof args.options.run===`string`):

          config.docker.imageId=arg.options.run;

        case (args.options.run):

          lib.runImage();
          break;

        default:

          log.log(`currently using image: ${config.docker.imageId||'none'}`);
          break;

      }

      callback();

    }
    catch(e) {

      log.error(e.message);
      log.debug(e.stack);

    }

  });

  vantage.command(`instance`, `Manage a SQL Server for Linux Container instance.`)
  .option(`-a, --all`, `Local SQL Server Containers`)
  .option(`-c, --connection [OPEN*|CLOSE]`, `open an mssql connection to current target`)
  .option(`-f, --full`, `Attributes of target SQL Server\'s container`)
  .option(`-i, --id [container-id]*`, `Target a SQL Server container (defaults to first detected instance)`)
  .option(`-r, --restart`, `Restart target SQL Instance if running (preserves open pool)`)
  .option(`-s, --start`, `Start target Container Instance - but only if stopped`)
  .option(`-x, --stop`, `Stop target Container Instance`)
  .action( (args, callback) => {

    try {

      log.debug(`instance ${lib.format(args)}`);
      let containerId = childProcess.execSync(`docker ps --filter "id=${config.docker.containerId}" --format "{{.ID}}"`).toString().trim();

      switch(true) {

        case (args.options.all):

          log.debug(`docker ps -a --filter "ancestor=${config.docker.repo}"`);
          log.log(lib.format( childProcess.execSync(`docker ps -a --filter "ancestor=${config.docker.repo}"`)));
          break

        case (/^close$/i.test(args.options.connect)):

          sqldb.closePool(pool);
          log.debug('pool closed');
          log.debug(pool);
          break;

        case (args.options.connect):

        case (/^open$/i.test(args.options.connect)):

          pool=sqldb.openPool();
          log.debug('pool');
          log.debug(pool);
          break;

        case (args.options.full):

          log.debug(`docker ps -a --filter "id=${config.docker.containerId}"`);
          log.log(lib.format(childProcess.execSync(`docker ps -a --filter "id=${config.docker.containerId}"`)));
          break;

        case (typeof args.options.id==='string'):

          lib.setInstance(args.options.id);
          break;

        case (args.options.id):

          lib.setInstance(config.docker.containerId);
          break;

        case (args.options.restart):

          if (!containerId) {
            log.warn(`sqlpal`.rainbow+` only restarts a running SQL Server, try '--start'.`);
          } else {
            lib.startContainer('restart', config.docker.containerId);
          }
          break;

        case (args.options.start):

          if (containerId===config.docker.containerId) {
            log.warn(`sqlpal`.rainbow + ` only starts a stopped SQL Server, try '--restart'.`);
          } else {
            lib.startContainer('start', config.docker.containerId);
          }
          break;

        case (args.options.stop):

          lib.stopContainer();
          break;

        default:

          log.log(`targeting container: ${config.docker.containerId||'none'}`);
          break;

      }

    }
    catch(e) {

      log.error(e.message);
      log.debug(e.stack);

    }

    callback();

  });

  vantage.command(`list`, `Inspect Host Volume SQL Server Collections`)
  .option(`-b, --backups`, `SQL Server Database backups files`)
  .option(`-c, --dumps`, `SQL Server Core Stack Dump files`)
  .option(`-d, --data`, `SQL Server Database Data files`)
  .option(`-l, --log`, `SQL Server Database Log files`)
  .option(`-v, --vorpal`, `Vorpal CLI commands`)
  .action( (args, callback) => {

    log.debug(`list ${lib.format(args)}`);
    try {

      switch(true) {

        case (args.options.backups):

          lib.listFiles(path.resolve(__dirname, config.mssql.backup.path), config.mssql.backup.filter)
          break;

        case (args.options.dumps):

          lib.listFiles(path.resolve(__dirname, config.mssql.dump.path), config.mssql.dump.filter)
          break;

        case (args.options.data):

          lib.listFiles(path.resolve(__dirname, config.mssql.data.path), config.mssql.data.filter)
          break;

        case (args.options.log):

          lib.listFiles(path.resolve(__dirname, config.mssql.log.path), config.mssql.log.filter)
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
            log.log(lib.format(results));
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

  vantage.command(`cache`, `Non-persistent App Object Inspector`)
  .alias(`?`)
  .option(`-b, --batch [c|clear]`, `T-SQL Batch Cache Object`)
  .option(`-c, --compile <sqlcmd|bcp|query|batch>`, `Query Command-line`)
  .option(`-k, --key [batch-history-key]`, `T-SQL Batch History of Vantage Session`)
  .option(`-v, --vantage`, `Vantage Session Command-line History`)
  .action( (args, callback) => {

    try {

      let result='';
      log.debug(`cache ${lib.format(args)}`);

      switch(true) {

        case (typeof args.options.compile!='undefined'):

          switch (true) {
            case (/^sqlcmd$/i.test(args.options.compile)):

              result=`${config.odbc.path}/sqlcmd\n` +
                lib.compile(config.sqlcmd.switch) +
                `\n[-q | -Q]\n"` +
                lib.compile(config.sqlcmd.prefix) + '\n' +
                lib.compile(Batch)
                + `"`;
              break;

            case (/^bcp$/i.test(args.options.compile)):

              result=`${config.odbc.path}/bcp ` + 'WHO? WHAT?' +
                `\n[ -i  data-file | -o  new-file ]\n"`;
              break;

            case (/^query$/i.test(args.options.compile)):

              result=lib.compile([`new mssql.Request(vantage.pool).query("${lib.compile(Batch)}");`]);
              break;

            case (/^batch$/i.test(args.options.compile)):

              result=lib.compile([`new mssql.Request(vantage.pool).batch("${lib.compile(Batch)}");`]);
              break;

            default:

              result='';
              vantage.exec(`help cache`);
              break;

          }
          break;

        case (args.options.key):

          result=config.cache.batchHistory;
          break;

        case (typeof args.options.key==='timestamp'):

          result=config.cache.batchHistory[args.options.key];
          break;

        case (typeof args.options.switch==='string'):

          result=config.sqlcmd.switch[args.options.switch];
          break;

        case (typeof args.options.vantage):

          vantage.history;

        case (typeof args.options.batch!='undefined'):

          if (args.options.batch==='clear'||args.options.batch==='c') {
            Batch.splice(0);
            result=`batch cleared`;
          }

        default:

          result=lib.compile(Batch);
          break;

      }

      log.log(lib.format(result));

      callback();

    }
    catch(e) {

        log.error(e.message);
        log.debug(e.stack);
    }

  });

  vantage.command(`bcp [ table-name ]`, `Bulk Copy Data`)
  .option(`-i, --input [ data-file | T-SQL | TABLE | VIEW ]`, `source of data`)
  .option(`-o, --output [ data-file ]`, `result output file (default stdout)`)
  .action( (args, callback) => {

    log.debug(`bcp ${lib.format(args)}`);
    try {

      log.debug(`not here yet. try bcp at bash prompt -  or use the interactive an bash prompt 'config -m EDIT'`);
      config.bcp.switch.U = config.bcp.switch.U || config.mssql.sa.name;
      config.bcp.switch.P = config.bcp.switch.P || config.mssql.sa.password;

      callback();

    }
    catch(e) {

        log.error(e.message);
        log.debug(e.stack);

    }

  });

  vantage.command(`sqlcmd`, `Process a cached batch or file script using sqlcmd`)
  .option(`-e, --execsql`, `Process batch via sp_executesql, `+`after`.italic+` the prefix executes`)
  .option(`-i, --input <script-file>`, `process a T-SQL script file rather than the batch`)
  .option(`-Q, --Query`, `Process the prefixed batch and exit, rendering JSON results`)
  .option(`-p, --prefix`, `Inspect/Edit SET Statement(s) prefixed to all queries`)
  .option(`-q, --query`, `Process the prefixed batch in sqlcmd, rendering tabular results`)
  .option(`-o, --output <data-file>`, `write result to the file - one other option required`)
  .option(`-s, --switch [switch-flag]`, `Inspect/Edit Command-line parameters used by all queries`)
  .action( (args, callback) => {

    log.debug(`sqlcmd ${lib.format(args)}`);
    try {

      let child;
      let spawnArgs = [];

      config.sqlcmd.switch.U = config.sqlcmd.switch.U || config.mssql.sa.name;
      config.sqlcmd.switch.P = config.sqlcmd.switch.P || config.mssql.sa.password;

      Object.keys(config.sqlcmd.switch).forEach((key) => {
          spawnArgs.push(`-${key}`);
          if (config.sqlcmd.switch[key]!=key) {
            spawnArgs.push(config.sqlcmd.switch[key])
          }
      });

      switch(true) {

        case (args.options.execsql) :

          spawnArgs.push(`-Q`)
          spawnArgs.push(`${lib.compile(config.sqlcmd.prefix)} exec sp_executesq('${lib.compile(Batch)}')`);
          log.debug(`sqlcmd executesql ${JSON.stringify(spawnArgs)}`);
          break;

        case (typeof args.options.input==='string') :

          spawnArgs.push(`-i`)
          spawnArgs.push(args.options.input);
          break;

        case (args.options.prefix):

          result=config,sqlcmd.prefix;
          break;

        case (args.options.switch):

          result=config.sqlcmd.switch;
          break;

        case (args.options.Query) :

          spawnArgs.push(`-Q`)
          spawnArgs.push(`${lib.compile(config.sqlcmd.prefix)} ${lib.compile(Batch)}`)
          break;

        case (args.options.query) :

        default:

          spawnArgs.push(`-q`);
          if (config.sqlcmd.prefix.length>0) {
            spawnArgs.push(`${lib.compile(config.sqlcmd.prefix)} ${lib.compile(Batch)}`);
          }
          log.info(`type 'exit' when ready to close sqlcmd and resume `+`sqlpal`.rainbow);
          log.debug(`(spawnSync) ${path.resolve(config.odbc.path, 'sqlcmd')} ${spawnArgs.join(' ')}`);
          childProcess.spawnSync(path.resolve(config.odbc.path, 'sqlcmd'), spawnArgs, {
            stdio: [0, 1, 2]
          });
          break;

      }

      if (typeof args.options.output==='string') {

        spawnArgs.push(`-o`)
        spawnArgs.push(args.options.output);

      }

      log.debug(lib.format(spawnArgs));
      log.debug(`(spawnAsync) ${path.resolve(config.odbc.path, 'sqlcmd')} ${spawnArgs.join(' ')}`);
      childProcess.spawnAsync(path.resolve(config.odbc.path, 'sqlcmd'), spawnArgs, {
        stdio: ['inherit', 'inherit', 'inherit']
      });

      lib.archiveBatch();

      callback();

    }
    catch(err) {

      log.debug(`sqlcmd failed`)
      log.error(err.message);
      log.debug(err.stack);

    }

  });

  vantage.command(`sqlog [ext]`, `SQL Server errorlog from Host Volume (default ext: none)`)
  .alias(`errorlog`)
  .option(`-h, --head [[-]K]`, `first 'K' lines or up to '-K' (default: first 10)`)
  .option(`-l, --list`, `available log files at ${config.mssql.log.path}`)
  .option(`-t, --tail [[+]K]`, `last 'K' lines or from '+K' (default: last 10)`)
  .action( (args, callback) => {
    // ??? would be no dependencies on the host volume if 'docker container logs ${containerId}' were used
    log.debug(`sqlog ${lib.format(args)}`);
    try {

      let shellscript;
      let ename = `errorlog${typeof args.ext==='undefined'? '': '.' + args.ext}`
      let elog = path.resolve(config.mssql.log.path, ename);

      switch (true) {

        case (['boolean', 'number'].includes(typeof args.options.head)) :

          // head -n K is the number of lines, head -n -K is beginning to line# K
          shellscript = `head ${elog} -n ${typeof args.options.head==='number'? args.options.head: 10}`;
          break;

        case (args.options.list) :

          shellscript = `ls ${elog}| grep elog`;
          break;

        case (['boolean', 'number'].includes(typeof args.options.tail)) :

          // tail -n K is the number of lines, head -n +K is from line# K to end
          shellscript = `tail ${elog} -n ${typeof args.options.tail==='number'? args.options.tail: 10}`;
          break;

        default :

          // numbers the output lines
          shellscript = `cat ${elog} -n`;
          break;

      }

      log.debug(`script: ${shellscript}`);
      log.warn(`Persistent SQL Server volume on '${process.env["HOST"]}'`);
      log.info(`If no persisted volume, use 'SERVER -s'; see ${config.mssql.log.path} once in shell`);

      log.log(lib.format([childProcess.execSync(`sudo ${shellscript}`).toString()]));
      callback();

    }
    catch(err) {

      log.error(err.message);
      log.debug(err.stack);

    }

  });

  vantage.catch('[tsql...]')
  .description(lib.commandAid(vantage.commands))
  .action( (args, callback) => {

    if (line.length>0) {

      log.debug(`linereader line: ${lib.format(args)}`);
      log.debug(`keylogger line: ${line}`);

      switch (true) {

        case (!args.tsql) :
          break;

        case (/^debug$/i.test(args.tsql[0])) :
          // for better or worse, this will clean-up any bogus previous or file value
          // setting loglevel to 30, 40 or 50 will suppress the linereader
          //   log.debug(msg) (loglevel 10)
          //   log.log(msg) (loglevel 20)
          //   log.info(msg) (loglevel 20)
          //   log.confirm(msg) (loglevel 20)
          //   log.warn(msg) (loglevel 30)
          //   log.error(msg) (loglevel 40)
          //   log.fatal(msg) (loglevel 50)

          if (/^ON$/i.test(args.tsql[1])) {
            vantage.exec(`logLevel 10`);
            log.debug(`${args.tsql[0]} is ${args.tsql[1]}`);
          }
          if (/^OFF$/i.test(args.tsql[1])) {
            vantage.exec(`logLevel 20`);
            log.info(`${args.tsql[0]} is ${args.tsql[1]}`);
          }
          break;

        case (/^GO$/i.test(line)) :
          sqldb.query();
          break;

        case (/^QUERY$/i.test(line)) :
          // list the collection
          log.log(queryStore.names());
          break;
        // otherwise overload the query into the batch
        case (/^QUERY$/i.test(args.tsql[0])) :
          log.debug(`query "${args.tsql[1]}"`);
          queryStore.getBatch(args.tsql[1]);
          break;

        case (/^RUN$/i.test(line)) :
          sqldb.batch();
          break;

        case (/^SCRIPT$/i.test(line)) :
          lib.listFiles(path.resolve(__dirname, config.vantage.vorpalCLI.scriptPath), `.sql`);
          break;
        // like QUERY - no second value is special case indicating list available
        case (/^SCRIPT$/i.test(args.tsql[0])) :
          lib.fileToBatch(path.resolve(__dirname, config.vantage.vorpalCLI.scriptPath, args.tsql[1]));
          break;

        case (/^TEST$/i.test(line)) :
          sqldb.isSQL();
          break;

        default:
          Batch.push(line);
          break;

      }

    } else {

      if (Batch.length>0) {
        Batch.push('');
      }

    }

    callback();

  });

});
