const colors = require('colors');
const mssql = require('mssql');
const Promise = require('bluebird');
const querystring = require('querystring');
//const sqlpad = require('sqlpad');
const watch = require('vantage-watch'); // config.json, mssql.json, queries.js, ./scripts/<name>.sql
const Vantage = require('vantage');
const vorpalLog = require('vorpal-log');

//// core
const childProcess = Promise.promisifyAll(require('child_process'));
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
//// local
const config = require(`./config.json`);
const queries = require(`./queries`);
const lib = require('./lib');

// use arg[2] - e.g., node index.js 2381 - else use config.json
const port = process.argv[2] && !Number.isNaN(process.argv[2])? process.argv[2]: config.vantage.port;

//// init caches
const Batch = config.cache.Batch;
const BatchHistory = config.cache.BatchHistory;
const Prefix = config.cache.Prefix;
const Switch = config.cache.Switch;
let line = '';

Switch.U = config.sql.sa.name;
Switch.P = config.sql.sa.password;

// not sure it matters, but everything else is using bluebird...
//mssql.Promise = Promise;

mssql.on('error', err => {
  log.warn('mssql driver error');
  log.error(err.message);
  log.debug(err.stack);
});

const vantage = new Vantage();

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

// preserve the raw line for building the batch
// !!! padding is already stripped here :(
vantage.on('client_prompt_submit', (data) => {
  log.debug(`line ${data}`);
  line = data;
});

// nothing, seems they took the 'basic' middleware out of vantage?
vantage.auth(config.vantage.auth.middleware, {
  "users": config.vantage.auth.users,
  "retry": config.vantage.auth.retry,
  "retryTime": config.vantage.auth.retryTime,
  "deny": config.vantage.auth.deny,
  "unlockTime": config.vantage.auth.unlock
});

const interactiveSession = function(containerId) {

  if (!containerId) containerId = config.docker.containerId;

  if (containerId) {

    // (re)create link files (-d detatched)
    childProcess.execSync(`docker exec -d ${containerId} /bin/bash
      docker exec -d ${containerId} ln -sf ${config.odbc.path}/sqlcmd /usr/bin
      docker exec -d ${containerId} ln -sf ${config.odbc.path}/bcp /usr/bin
      docker exec -d ${containerId} ln -sf -T ${config.sql.conf} /usr/bin/mssql-conf`);

    log.info([`'bcp, 'mssql-conf' and 'sqlcmd' are available inside container.`,
      `type a command with no args for more usage information`,
      `'bcp' and 'sqlcmd' work using '-Usa -P "$SA_PASSWORD"'`,
      `type 'exit' to close session inside container and resume sql prompt`].join('\n'));

    // open interactive terminal
    let child = childProcess.spawnSync(`docker`, [`exec`, `--interactive`, `--tty`, `${containerId}`, `/bin/bash`], {
      stdio: ['inherit', 'inherit', 'inherit']
    });

  }

}

const isSQL = function() {

  if (Batch.length>0) {
      return new mssql.Request(vantage.pool).query(lib.compile([`SET NOEXEC ON;`].concat(Batch)))
      .then( (nodata) => {   // { recordsets: [], recordset: undefined, output: {}, rowsAffected: [] }
        log.debug([`SQL Server parsed and compiled the Batch`,
          `However`.yellow + `, object references ` + `have not`.underline.yellow + ` been verified`].join('\n'));
        return true;
      })
      .catch( (err) => {
        log.warn(`SQL Server is unable to parse and compile the Batch`);
        log.error(err.message);
        log.debug(err.stack);
      });
  }

};

const listFiles = function(path, filter) {

  return fs.readdirAsync(path)
  .then((files) => {
    log.info(`${args.options}: ${path}`);
    files.forEach( function(file) {
      if (file.includes(filter)) {
        log.log(lib.format(file));
      }
    });
  })
  .catch((err) => {
    log.error(err.message);
    log.debug(err.stack);
  });

};

const runImage = function() {

  if (config.docker.imageId) {
    log.info(`running image ${config.docker.imageId}`);
    let run = `sudo docker run
      -e "ACCEPT_EULA=${config.sql.acceptEULA}"
      -e "SA_PASSWORD=${config.sql.sa.password}"
      -p ${config.docker.hostPort}:${config.docker.sqlPort}
      -v ${config.docker.sqlVolume}:${config.docker.sqlVolume}
      -d ${config.docker.imageId}`;
    log.debug(run);
    childProcess.execSync(run);
  }

};

const setImage = function(imageId) {

  if (!imageId) { // find locally if not passed
    imageId = childProcess.execSync(`docker images ${config.docker.image}:latest --format "{{.ID}}"`).toString().trim();
    if (!imageId) { // download latest if not passed or found locally
      childProcess.execSync(`docker pull ${config.docker.image}`);
      imageId = childProcess.execSync(`docker images ${config.docker.image}:latest --format "{{.ID}}"`).toString().trim();
    }
  }
  config.docker.imageId = imageId;
  log.debug(`image ${config.docker.imageId} ready`);

};

const setInstance = function(containerId) {

  // start with latest image
  setImage();

  // the most recently started running SQL Server container - !!!could be more and would be returned here!!!
  let sqinstance = childProcess.execSync(`docker ps --filter "ancestor=${config.docker.image}" --format "{{.ID}}"`).toString().trim();
  let sqlatest = childProcess.execSync(`docker ps --latest --filter "ancestor=${config.docker.image}" --format "{{.ID}}"`).toString().trim();
  let sqid = containerId || sqinstance || sqlatest;
  let sqimage = childProcess.execSync(`docker ps --latest --filter "id=${sqid}" --format "{{.Image}}"`).toString().trim();
  let sqatus = childProcess.execSync(`docker ps --latest --filter "id=${sqid}" --format "{{.Status}}"`).toString();

  if (config.docker.imageId) {

    if (config.docker.imageId!=sqimage) {
      log.warn(`other SQL Server images may be available on this server`);
      log.log(childProcess.execSync(`docker images ${config.docker.image}`).toString());
      config.docker.imageId = sqimage;
    }
// ??? what about a container from --latest that is not running ???
    if (!sqid) {
      // init new instance
      if (!config.docker.imageId) {
        runImage();
        config.docker.containerId = childProcess.execSync(`docker ps --filter "ancestor=${config.docker.image}" --format "{{.ID}}"`).toString().trim();
      }
      startContainer('start', sqid);
    } else {
      if (!sqinstance) {
        startContainer('start', sqid);
      }
      config.docker.containerId = sqid;
      openPool();
    }
    log.debug(`containerId ${config.docker.containerId} status: ${sqatus}`);

  }

};

function getConnection(urlString) {

    return new Promise(function(resolve) {
        //Without new Promise, this throwing will throw an actual exception
        var params = parse(urlString);
        resolve(getAdapter(params).getConnection());
    });
}

const startContainer = function(startType, containerId) { // start or restart
  // 'start' or 'restart'
  log.debug(`Promising container ${containerId} ${startType}`);
  return new Promise(function(resolve) {
    log.confirm(`${startType}ing SQL Server container ${containerId}`);
    return childProcess.execAsync(`docker container ${startType} ${containerId}`)
    .then( () => {
      return childProcess.execAsync(`docker ps --filter "id=${containerId}" --format "{{.Image}}"`)
    })
    .then( (imageId) => {
      setImage(imageId.toString().trim());
      config.docker.containerId = containerId;
      log.info(`instance ${config.docker.containerId} ${startType}ed
        issue 'instance --connect' after SQL Server recovery is complete`);
      // inheritance assures the child stops when this process stops
      return childProcess.spawnAsync(`docker`, [`logs`, `--follow`, `${containerId}`, `--tail`, 0], {
        stdio: [0, 'inherit', 'inherit']
      });
    })
    .catch( (err) => {
      log.warn(`SQL Server Container ${containerId} failed to start`);
      log.error(err.message);
      log.debug(err.stack);
    });
  });
};

const stopContainer = function() {
  log.confirm('stopping SQL Server\'s container...')
  vantage.pool.close();
  childProcess.execAsync(`docker container stop ${config.docker.containerId}`)
  .then( function() {
    log.log(`container '${config.docker.containerId}' closed`);
  })
  .catch( (err) => {
    log.debug(`failed while stopping container ${config.docker.containerId}`);
    log.error(err.message);
    log.debug(err.stack);
  });
};

// !!! must come after vantage to attach pool  !!!
const openPool = function(retryCount) {

  log.debug('opening Pool');
  if (!retryCount) retryCount=0;
  vantage.pool = new mssql.ConnectionPool({
    user: config.sql.sa.name,
    password: config.sql.sa.password,
    server: config.cache.Switch.S,
    database: config.cache.Switch.d,
    pool: config.odbc.pool
  }, (err) => {
    if (err) {
// retry 3 time but give it a 10 seconds()?) after 1st and 2nd trys
log.debug(`user: ${config.sql.sa.name},
    password: ${config.sql.sa.password},
    server: ${config.cache.Switch.S},
    database: ${config.cache.Switch.d},
    pool: ${config.odbc.pool}`);
      log.error(err.message);
      log.debug(err.stack);
      if (retryCount<2) {
        retryCount++;
        setTimeout(() => {
          log.warn(`open connection pool retry #${retryCount} of 2`);
          openPool(retryCount); }, 10000);
      } else {
        log.warn(`problem opening new connection pool`);
      }
    } else {
      new mssql.Request(vantage.pool).query(queries.sqlVersion)
      .then( (results) => {
        log.log(lib.format(results.recordsets));
      })
      .catch( (err) => {
        log.warn(`sqlVersion query error`);
        log.error(err.message);
        log.debug(err.stack);
      });
    }
  });

  vantage.pool.on('close', () => {
    lib.archiveBatches();
  });

  vantage.pool.on('error', err => {
    log.warn('connection pool error');
    log.error(err.message);
    log.debug(err.stack);
  });

};

vantage
  .use( vorpalLog, {printDate: config.printDate})
  .banner(lib.bandaid)
  .listen(port)
  .delimiter(`sqlpal`.rainbow+`@${config.vantage.port}~`)
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
  // validate the rule ip - v4 or v6? https://jsfiddle.net/AJEzQ/
  if ( /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/.test(rule.ip)){
    // build that wall (tested IPv4 only)
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
  }
});

vantage.command(`config`, `Configurations`)
  .option(`-a, --app`, `* ${path.resolve(__dirname, 'config.json')}`)
  .option(`-m, --mssql`, path.resolve(config.docker.sqlVolume, 'mssql.conf'))
  .option(`-s, --sqlserver ['option-name']`, `sys.configurations`)
  .action( (args, callback) => {

    log.debug(`config ${lib.format(args.options)}`);

    switch(true) {

      case (args.options.mssql===true):

        interactiveSession()

        break;

      case (args.options.sqlserver===true):

        new mssql.Request(vantage.pool).query(queries.configurations)
        .then( (results) => {
          log.debug(results);

          log.log(lib.format(results.recordsets));
          log.info(`To see one configuration, include enough of the first character`,
            `of name to uniquely identitfy the setting (in quotes if any spaces)`);

        })
        .catch((err) => {
          log.error(err.message);
          log.debug(err.stack);
        });

        break;

      case (typeof args.options.sqlserver==='string'):

        new mssql.Request(vantage.pool).query(`EXEC sp_configure '${args.options.sqlserver}'`).then( results => {

          results.recordset[0].name
          log.log(lib.format(results.recordset));
          log.info([`T-SQL to change:`,
            `\tEXEC sp_configure '${results.recordset[0].name}' <new-value>;`,
            `\tRECONFIGURE [WITH OVERRIDE];`].join('\n'));
        });

        break;

      case (args.options.app):

      default:

        return fs.readFileAsync(path.resolve(__dirname, 'config.json'))
        .then((fileBuffer) => {
          log.log(lib.format(JSON.parse(fileBuffer.toString())));
          log.info(`Use a text editor to change file '${path.resolve(process.cwd(), 'config.json')}`);
        })
        .catch((err) => {
          log.error(err.message)
          log.debug(err.stack);
        });

        break;

    }

    callback();

});

vantage.command(`engine`)
  .description(`Manage the Docker Container Engine`)
  .option(`-r, --status`, `Status Report`)
  .option(`-s, --start`, `Start Container Engine`)
  .option(`-x, --stop`, `Stop Container Engine`)
  .action( (args, callback) => {

    log.debug(`engine ${lib.format(args)}`);
    try {

      if (['start', 'stop'].includes(args.options.docker.toLowerCase())) {

        childProcess.exec(`sudo service docker ${args.options.docker}`, function() {
          log.info(`Docker ${args.options.docker}`)
        });

      } else {

        if (/^status$/i.test(args.options.docker)) {
          log.log(lib.format(childProcess.execSync(`sudo service docker status`)));
        }
        log.warn(`${args.options.docker}?`);

      }

      callback();

    }
    catch(e) {

      log.error(e.message);
      log.debug(e.stack);

    }

  });

vantage.command(`image`)
  .description(`Dockerhub SQL Server for Linux Image`)
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

          log.log(lib.format(childProcess.execSync(`docker images -a ${config.docker.image}`)));

          break;

        case (args.options.full):

          log.log(lib.format(childProcess.execSync(`docker images -a ${config.docker.image}`)));

          break;

        case (args.options.id):

          setImage();
          log.log(config.docker.imageId);

          break;
        case (args.options.pull):

          config.docker.imageId='';
          setImage();

          break;

        case (typeof args.options.run===`string`):

          config.docker.imageId=arg.options.run;

        case (args.options.run):

          runImage();
          break;

        default:

          setImage();
          break;

      }

      callback();

    }
    catch(e) {

      log.error(e.message);
      log.debug(e.stack);

    }

  });

vantage.command(`instance`, `Manage a Contained SQL Server Instance`)
  .option(`-a, --all`, `Local SQL Server Containers`)
  .option(`-c, --connection [OPEN*|CLOSE]`, `open mssql connection pool to target`)
  .option(`-f, --full`, `Attributes of target SQL Server\'s container`)
  .option(`-i, --id [container-id]*`, `ID of targeted SQL Server container (@@SERVERNAME)`)
  .option(`-r, --restart`, `Restart target SQL Instance if running (preserves open pool)`)
  .option(`-s, --start`, `Start target Container Instance - but only if stopped`)
  .option(`-x, --stop`, `Stop target Container Instance`)
  .action( (args, callback) => {

    try {

      log.debug(`instance ${lib.format(args)}`);
      let containerId = childProcess.execSync(`docker ps --filter "id=${config.docker.containerId}" --format "{{.ID}}"`).toString().trim();

      switch(true) {

        case (args.options.all):

          log.log(lib.format( childProcess.execSync(`docker ps -a --filter "ancestor=${config.docker.image}"`)));
          break

        case (/^close$/i.test(args.options.connect)):

          vantage.pool.close();
          break;

        case (args.options.connect):

        case (/^open$/i.test(args.options.connect)):

          openPool();
          break;

        case (args.options.full):

          log.log(lib.format(childProcess.execSync(`docker ps --all --filter "id=${config.docker.imageId}"`)));
          break

        case (args.options.restart):

          if (!containerId) {
            log.warn('sqlpal`.rainbow+` only restarts a running SQL Server');
          } else {
            startContainer('restart', config.docker.containerId);
          }
          break;

        case (args.options.start):

          if (containerId===config.docker.containerId) {
            log.warn('sqlpal`.rainbow+` only starts a stopped SQL Server');
          } else {
            startContainer('start', config.docker.containerId);
          }
          break;

        case (args.options.stop):

          if (!running) {
            log.warn('sqlpal`.rainbow+` only stops a running SQL Server');
          } else {
            stopContainer();
          }
          break;

        case ('id'):

          // prompt for containerId to start
          //let containerId = childProcess.execSync(`docker ps --filter "id=${config.docker.containerId}" --format "{{.ID}}"`).toString().trim();

        default:

          setInstance(config.docker.containerId);
          break;

      }

      callback();

    }
    catch(e) {

      log.error(e.message);
      log.debug(e.stack);

    }

  });

vantage.command(`list`, `Collections`)
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

          listFiles(path.resolve(__dirname, config.sql.backup.path), config.sql.backup.filter)
          break;

        case (args.options.dumps):

          listFiles(path.resolve(__dirname, config.sql.dump.path), config.sql.dump.filter)
          break;

        case (args.options.data):

          listFiles(path.resolve(__dirname, config.sql.data.path), config.sql.data.filter)
          break;

        case (args.options.log):

          listFiles(path.resolve(__dirname, config.sql.log.path), config.sql.log.filter)
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

vantage.command(`cache`, `Cache Operations`)
  .alias(`?`)
  .option(`-B, --Batch [clear]`, `T-SQL Batch Cache Object`)
  .option(`-c, --compile <sqlcmd|bcp|query|batch>`, `Show T-SQL as compiled from cache objects`)
  .option(`-h, --history`, `Command-line History`)
  .option(`-k, --key [batch-history-key]`, `T-SQL Batch History key-pair Object`)
  .option(`-P, --Prefix`, `SET Statement(s) Prefix Cache Object`)
  .option(`-S, --Switch [switch-key]`, `Db Connection Options Cache Object`)
  .option(`-v, --vorpal`, `Vorpal Session command-line History`)
  .action( (args, callback) => {

    try {

      let result='';
      log.debug(`cache ${lib.format(args)}`);

      switch(true) {

        case (typeof args.options.compile!='undefined'):

          switch (true) {
            case (/^sqlcmd$/i.test(args.options.compile)):

              result=`${config.odbc.path}/sqlcmd\n` +
                lib.compile(Switch) +
                `\n[-q | -Q]\n"` +
                lib.compile(Prefix) + '\n' +
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

        case (typeof args.options.history):

          result= vantage.history;
          break;

        case (args.options.key):

          result=BatchHistory;
          break;

        case (typeof args.options.key==='timestamp'):

          result=BatchHistory[args.options.key];
          break;

        case (args.options.prefix):

          result=Prefix;
          break;

        case (args.options.switch):

          result=Switch;
          break;

        case (typeof args.options.switch==='string'):

          result=Switch[args.options.switch];
          break;

        case (typeof args.options.vorpal):

          vorpal.history();

        case (typeof args.options.Batch!='undefined'):

          if (args.options.Batch==='clear'|args=='-') {
            Batch.splice(0);
            result=`Batch cleared`;
          }

        default:

          result=lib.compile(Batch);
          break;

      }

      log.debug('cache operation complete');
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

      callback();

    }
    catch(e) {

        log.error(e.message);
        log.debug(e.stack);

    }

  });
vantage.command(`sqlcmd`, `Process the Batch using settings in Switch cache`)
  .option(`-e, --execsql`, `Process Batch in isolation from Prefix (wrap in sp_executesql)`)
  .option(`-i, --input <script-file>`, `process a T-SQL script file rather than the Batch`)
  .option(`-Q, --Query`, `Process the Prefixed Batch, return results and render in `+`sqlpal`.rainbow)
  .option(`-q, --query`, `Process the Batch, render results and wait for input in sqlcmd`)
  .option(`-o, --output <data-file>`, `write result to the file - one other option required`)
  .action( (args, callback) => {

    log.debug(`sqlcmd ${lib.format(args)}`);
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

        case (args.options.execsql) :

          spawnArgs.push(`-Q`)
          spawnArgs.push(`${lib.compile(Prefix)} exec sp_executesq('${lib.compile(Batch)}')`);
          log.debug(`sqlcmd executesql ${JSON.stringify(spawnArgs)}`);
          break;

        case (typeof args.options.input==='string') :

          spawnArgs.push(`-i`)
          spawnArgs.push(args.options.input);
          log.debug(`sqlcmd input ${JSON.stringify(spawnArgs)}`);
          break;

        case (args.options.Query) :

          spawnArgs.push(`-Q`)
          spawnArgs.push(`${lib.compile(Prefix)} ${lib.compile(Batch)}`)
          log.debug(`sqlcmd Query ${JSON.stringify(spawnArgs)}`);
          break;

        case (args.options.query) :

        default:

          spawnArgs.push(`-q`);
          if (Prefix.length>0) {
            spawnArgs.push(`${lib.compile(Prefix)} ${lib.compile(Batch)}`);
          }
          log.info(`type 'exit' to close sqlcmd and resume `+`sqlpal`.rainbow);
          child = childProcess.spawnSync(path.resolve(config.odbc.path, 'sqlcmd'), spawnArgs, {
            stdio: ['inherit', 'inherit', 'inherit']
          });
          break;

      }

      if (typeof args.options.output==='string') {

        spawnArgs.push(`-o`)
        spawnArgs.push(args.options.output);

      }

      if (!child) {

        child = childProcess.spawn(path.resolve(config.odbc.path, 'sqlcmd'), spawnArgs, {
          stdio: ['inherit', 'inherit', 'inherit']
        });

        child.on('close', (code) => {
          if (code!=0) {
            log.warn(lib.format(`sqlcmd exited with code ${code}`));
          }
        });

      }

      BatchHistory[Object.keys(BatchHistory).length] = Batch;
      Batch.splice(0);

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
  .option(`-l, --list`, `available log files at ${config.sql.log.path}`)
  .option(`-t, --tail [[+]K]`, `last 'K' lines or from '+K' (default: last 10)`)
  .action( (args, callback) => {
// ??? would be no dependencies on the host volume using ???
//    docker container logs ${containerId}
// ??? but it seems to include all(?) logs the SQL Server ever made rather than file(s) from some folder ???
// ??? does that mean there is a docker file somewhere growing out of control or is it a queue or is it actually reading the folder ???
    log.debug(`sqlog ${lib.format(args)}`);
    try {

      let ename = `errorlog${typeof args.ext==='undefined'? '': '.' + args.ext}`
      let elog = path.resolve(config.sql.log.path, ename);

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
      log.info(`If no persisted volume, use 'SERVER -s'; see ${config.sql.log.path} once in shell`);
      log.log(lib.format([childProcess.execSync(`sudo ${shellscript}`).toString()]));
      callback();

    }
    catch(err) {

      log.error(err.message);
      log.debug(err.stack);

    }

  });

vantage.command(`sqlpad`, `Instantiate local Chromium* web app URL for writing and running SQL queries and visualizing the results.`)
  .action( (args, callback) => {

    childProcess.exec(require('sqlpad'));

    callback();

  });

vantage.catch('[tsql...]')
  .description(lib.commandAid(vantage.commands))
  .action( (args, callback) => {

    if (line.length>0) {

      log.debug(`[tsql...] ${lib.format(args)}`);
      log.debug(`keylogged line: ${line}`);

      switch (true) {

        case (/^GO$/i.test(line)) :

          isSQL()
          .then( () => {
            return new mssql.Request(vantage.pool).query(lib.compile(Batch));
          })
          .then( (results) => {
            log.log(lib.format(results));
            BatchHistory[new Date] = Batch;
            Batch.splice(0);
          })
          .catch( (err) => {
            log.error(err.message);
            log.debug(err.stack);
          });

          break;

        case (/^QUERY$/i.test(line)) :

          log.log(lib.format(Object.keys(queries).join('\n')));
          break;

        case (/^QUERY$/i.test(args.tsql[0])) :

          let key = args.tsql[1];
          log.debug(`key ${key}`);
          if (queries[key]) {image
// save now (ditto script) and allow restore of current partial batch later
            Batch.splice(0);
            Batch.push(`-- ${line}`);
            if (typeof query==='string') {
              query.split('\n').forEach( function(line) {
                Batch.push(line);
              });
              log.debug(lib.format(Batch));
            }
          } else {
            log.warn(`unknown query ${key}`);
          }
          break;

        case (/^RUN$/i.test(line)) :

          isSQL()
          .then( () => {
            return new mssql.Request(vantage.pool).batch(lib.compile(Batch));
          })
          .then( (results) => {
            log.log(lib.format(results));
            BatchHistory[new Date] = Batch;
            Batch.splice(0);
          })
          .catch( (err) => {
            log.error(err.message);
            log.debug(err.stack);
          });

          break;

        case (/^SCRIPT$/i.test(line)) :

          return fs.readdirAsync(path.resolve(__dirname, config.scriptPath))
          .then((scripts) => {
            log.log(lib.format(scripts.join('\n')));
          })
          .catch((err) => {
            log.error(err.message);
            log.debug(err.stack);
          });
          break;

        case (/^SCRIPT$/i.test(args.tsql[0])) :

          return fs.readFileAsync(path.resolve(__dirname, config.scriptPath, line.split(' ')[1]), 'utf8')
          .then((script) => {

            if (typeof script==='string') {
              Batch.splice(0);
              Batch.push(`-- ${line}`);
              script.split('\n').forEach( function(qline) {
                Batch.push(qline);
              });
            }

          })
          .catch((err) => {
            log.error(err.message);
            log.debug(err.stack);
          });
          break;

        case (/^TEST$/i.test(line)) :

          isSQL()
          .then( () => {
            log.debug(lib.format(Batch));
          })
          .catch( (err) => {
            log.error(err.message);
            log.debug(err.stack);
          });

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

module.exports = exports = vantage;
