const mssql = require('mssql');
const Promise = require('bluebird');
const querystring = require('querystring');
const watch = require('vantage-watch');
const Vantage = require('vantage');
const vorpalLog = require('vorpal-log');

//// core
const childProcess = Promise.promisifyAll(require('child_process'));
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
//// local
const config = require(`./config.json`);
const queries = require(`./queries`);
const tools = require('./tools');

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
  return new mssql.Request(vantage.pool).query(tools.compile([`SET NOEXEC ON;`].concat(Batch)))
  .then( (nodata) => {
    log.debug('Batch parsed and compiled at SQL Server without issue');
    return true;
  })
  .catch( (err) => {
    log.warn(`SQL Server failed to parse and compile the Batch`);
//  dedup  log.error(err.message);
    log.debug(err.stack);
    return false;
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
  }
  if (!imageId) { // download latest if not passed or found locally
    childProcess.execSync(`docker pull ${config.docker.image}`);
    imageId = childProcess.execSync(`docker images ${config.docker.image}:latest --format "{{.ID}}"`).toString().trim();
  }
  if (imageId) { // set config to  resolved image
    config.docker.imageId = imageId;
    log.debug(`image ${config.docker.imageId} ready`);
  }
};

const setInstance = function() {

  //!!!! the running SQL Server container  ???what if there are 2+ running???
  let sqinstance = childProcess.execSync(`docker ps --filter "ancestor=${config.docker.image}" --format "{{.ID}}"`).toString().trim();
  let sqlatest = childProcess.execSync(`docker ps --latest --filter "ancestor=${config.docker.image}" --format "{{.ID}}"`).toString().trim();
  let sqid = sqinstance || sqlatest;
  let sqimage = childProcess.execSync(`docker ps --latest --filter "id=${sqid}" --format "{{.Image}}"`).toString().trim();
  let sqatus = childProcess.execSync(`docker ps --latest --filter "id=${sqid}" --format "{{.Status}}"`).toString();

  // start with latest image
  setImage();

  if (config.docker.imageId) {

    if (config.docker.imageId!=sqimage) {
      log.warn(`other SQL Server images may be available on this server`);
      log.log(childProcess.execSync(`docker images ${config.docker.image}`).toString());
      config.docker.imageId = sqimage;
    }
// not right, could be a container from --latest that is not running
    if (!sqid) {
      // init new instance
      if (!config.docker.imageId) {
        runImage();
        config.docker.containerId = childProcess.execSync(`docker ps --filter "ancestor=${config.docker.image}" --format "{{.ID}}"`).toString().trim();
      }
      log.debug('container starting...');
      startContainer('start', sqid);
    } else {
      config.docker.containerId = sqid;
      openPool();
    }
    log.log(`containerId ${config.docker.containerId} status: ${sqatus}`);

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
        issue 'server --container connect' after SQL Server recovery is complete`);
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

  log.log('opening Pool');
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
      log.error(err.message);
      log.debug(err.stack);
      if (retryCount<2) {
        retryCount++;
        log.warn(`open connection pool retry #${retryCount}`);
        setTimeout(() => { openPool(retryCount); }, 10000);
      } else {
        log.warn(`failed to open connection pool`);
      }
    } else {
      new mssql.Request(vantage.pool).query(queries.sqlVersion)
      .then( (results) => {
        log.log(tools.format(results.recordsets));
      })
      .catch( (err) => {
        log.warn(`sqlVersion query error`);
        log.error(err.message);
        log.debug(err.stack);
      });
    }
  });

  vantage.pool.on('close', () => {
    tools.archiveBatches();
  });

  vantage.pool.on('error', err => {
    log.warn('connection pool error');
    log.error(err.message);
    log.debug(err.stack);
  });

};

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
  // validate the rule ip - v4 or v6? https://jsfiddle.net/AJEzQ/
  if ( /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/.test(rule.ip)){
    // build wall
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

vantage.command(`config`, `Configuration`)
  .option(`-a, --app`, path.resolve(__dirname, 'config.json'))
  .option(`-m, --mssql`, path.resolve(config.docker.sqlVolume, 'mssql.conf'))
  .option(`-s, --sqlserver [ 'option-name' ]`, `sys.configurations (sp_configure)`)
  .action( (args, callback) => {

    log.debug(JSON.stringify(args));

    switch(true) {

      case (args.options.mssql):

        return fs.readFileAsync(path.resolve(config.docker.sqlVolume, 'mssql.conf'))
        .then((fileBuffer) => {
          log.log(tools.format(fileBuffer.toString()));
          log.info([`This file reflects SQL Server start-up configation options.`,
            `Do not edit this file. Open an interactive bash prompt inside the `,
            `container ('SERVER -s') then use the mssql-conf utility instead. ('MSSQL-CONF -h')`].join('\n'));
        })
        .catch((err) => {
          log.error(err.message);
          log.debug(err.stack);
        });

        break;

      case (args.options.sqlserver):

        new mssql.Request(vantage.pool).query(queries.configurations)
        .then( (results) => {
          log.debug(results);

          log.log(tools.format(results.recordsets));
          log.info(`To see one configuration, include enough of the first character`,
            `of name to uniquely identitfy the setting (in quotes if any spaces)`);

        })
        .catch((err) => {
          log.error(err.message);
          log.debug(err.stack);
        });

        break;

      case (typeof args.options.sqlserver=='string'):

        new mssql.Request(vantage.pool).query(`EXEC sp_configure '${args.options.sqlserver}'`).then( results => {

          results.recordset[0].name
          log.log(tools.format(results.recordset));
          log.info([`T-SQL to change:`,
            `\tEXEC sp_configure '${results.recordset[0].name}' <new-value>;`,
            `\tRECONFIGURE [WITH OVERRIDE];`].join('\n'));
        });

        break;

      case (args.options.app):

      default:

        return fs.readFileAsync(path.resolve(__dirname, 'config.json'))
        .then((fileBuffer) => {
          log.log(tools.format(JSON.parse(fileBuffer.toString())));
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
  .description(`Manage the SQL Server Instance`)
  .option(`-c, --container [ ALL | CONNECT | FULL | RESTART | START | STOP ]`, `SQL Server Instance`)
  .option(`-d, --docker [ START | STOP ]`, `Container Engine`)
  .option(`-i, --image [ All | FULL | PULL | RUN ]`, `SQL Server for Linux Image (from dockerhub)`)
  .option(`-s, --shell`, `bash prompt inside container (mssql-conf & mssql-tools)`)
  .action( (args, callback) => {

    try {

      let cmd='';
      log.debug(JSON.stringify(args));

      switch(true) {

        case (args.options.container):

          setInstance();

          break;

        case (typeof args.options.container=='string'):
// doesn't scale to 2+ containers per image
          let running = childProcess.execSync(`docker ps --filter "id=${config.docker.containerId}" --format "{{.ID}}"`).toString().trim();
          switch(args.options.container.toLowerCase()) {
            case ('all'):
              log.log(tools.format(childProcess.execSync(`docker ps --all --filter "ancestor=${config.docker.image}"`)));
              break
            case ('connect'):
              openPool();
              break;
            case ('full'):
              log.log(tools.format(childProcess.execSync(`docker ps --all --filter "id=${config.docker.imageId}"`)));
              break
            case ('restart'):
              if (!running) {
                log.warn('restart only valid when the SQL Server is running');
                break;
              } else {
                startContainer(args.options.container, config.docker.containerId);
              }
              break;
            case ('start'):

log.log(`running ${running} configured ${config.docker.containerId}`)
              if (running==config.docker.containerId) {
                log.warn('start only valid when SQL Server is stopped');
                break;
              } else {
                // check if already running - only start if stopped, only restart if running
                startContainer(args.options.container, config.docker.containerId);
              }
              break;
            case ('stop'):
              if (!running) {
                log.warn('stop only valid when the SQL Server is running');
                break;
              } else {
                stopContainer();
              }
              break;
            default:
              log.warn(`${args.options.container}?`);
              break;
          }

          break;

        case (args.options.docker):

          log.log(tools.format(childProcess.execSync(`sudo service docker status`)));

          break;

        case (typeof args.options.docker=='string'):

          if (['start', 'stop'].includes(args.options.docker.toLowerCase())) {

            childProcess.exec(`sudo service docker ${args.options.docker}`, function() {

              // if ('start'==args.options.docker.toLowerCase()) {
              //   vantage.exec('server --container start');
              // }

              log.info(`Docker ${args.options.docker}`)

            });

          } else {

            log.warn(`${args.options.docker}?`);

          }

          break;

        case (args.options.image):

          setImage();

          log.log(`imageId ${config.docker.imageId}`);

          break;

        case (typeof args.options.image=='string'):

          switch (args.options.image.toLowerCase()) {
            case ('all'):
              log.log(tools.format(childProcess.execSync(`docker images -a ${config.docker.image}`)));
              break;
            case ('pull'):
              config.docker.imageId='';
              setImage();
              break;
            case ('run'):
              runImage();
              break;
            default:
              log.warn(`$(args.options.image)?`)
              break;
          }

          break;

        case (args.options.shell):
log.log(args);
          interactiveSession()

          break;

        default:

          // log.log(tools.format(childProcess.execSync(`docker info`)));
          childProcess.execAsync(`docker info`)
          .then( (results) => {
            log.log(tools.format(results));
          })

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
  .option(`-r, --reader`, `Vorpal CLI Line Reader keywords`)
  .option(`-v, --vorpal`, `Vorpal CLI commands`)
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
                log.log(tools.format(file));
              }
            });
          })
          .catch((err) => {
            log.error(err.message);
            log.debug(err.stack);
          });

          break;

        case (args.options.dumps):

          return fs.readdirAsync(path.resolve(__dirname, config.sql.dump.path))
          .then((files) => {
            log.info(`Dump Path: ${path.resolve(__dirname, config.sql.dump.path)}`);
            files.forEach( function(file) {
              if (file.startsWith(config.sql.dump.filter)) {
                log.log(tools.format(file));
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
                log.log(tools.format(file));
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
                log.log(tools.format(file));
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
            log.log(tools.format(results));
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
  .option(`-b, --batch [ clear ]`, `T-SQL Batch Cache`)
  .option(`-c, --compile < sqlcmd | bcp | query | batch >`, `Compile cache into db `)
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
              result=`${config.odbc.path}/bcp ` + 'WHO? WHAT?' +
                `\n[ -i  data-file | -o  new-file ]\n"`;
              break;
            case (/^query$/i.test(args.options.compile)):
              result=tools.compile([`new mssql.Request(vantage.pool).query("${tools.compile(Batch)}");`]);
              break;
            case (/^batch$/i.test(args.options.compile)):
              result=tools.compile([`new mssql.Request(vantage.pool).batch("${tools.compile(Batch)}");`]);
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

          result= vantage.history;

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
      log.log(tools.format(result));

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

    try {

      log.debug(JSON.stringify(args));
      log.debug(`try bcp at terminal bash prompt or interactive bash prompt 'server -s'`);

      callback();

    }
    catch(e) {

        log.error(e.message);
        log.debug(e.stack);

    }

  });

vantage.command(`sqlcmd`, `Process the Batch with sqlcmd`)
  .option(`-e, --execsql`, `Process Batch in isolation from Prefix (sp_executesql)`)
  .option(`-i, --input <script-file>`, `process T-SQL in the fully qualified 'script-file'`)
  .option(`-Q, --Query`, `Process the Prefixed Batch, return results and render in sqlpal`)
  .option(`-q, --query`, `Process the Batch, render and wait for input in the sqlcmd session`)
  .option(`-o, --output [ data-file ]`, `write result to a file on this sqlpal host`)
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

        case (args.options.execsql) :

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

          log.warn(`type 'exit' to close sqlcmd and resume sqlpal`);

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
            log.warn(tools.format(`sqlcmd exited with code ${code}`));
          }
        });

      }

      BatchHistory[Object.keys(BatchHistory).length] = Batch;
      Batch.splice(0);

      log.debug('sqlcmd complete')


      callback();

    }
    catch(err) {

      log.debug(`sqlcmd failed`)
      log.error(err.message);
      log.debug(err.stack);

    }

  });

vantage.command(`sqlog [ext]`, `SQL Server errorlog (default: active log)`)
  .alias(`errorlog`)
  .option(`-h, --head [[-]K]`, `first 'K' lines or up to '-K' (default: first 10)`)
  .option(`-l, --list`, `available log files at ${config.sql.log.path}`)
  .option(`-t, --tail [[+]K]`, `last 'K' lines or from '+K' (default: last 10)`)
  .action( (args, callback) => {

// docker container logs ${containerId}

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
      log.log(tools.format([childProcess.execSync(`sudo ${shellscript}`).toString()]));


      callback();

    }
    catch(err) {

      log.error(err.message);
      log.debug(err.stack);

    }

  });

vantage.catch('[tsql...]')
  .action( (args, callback) => {

      log.debug(`line ${line}`);
      log.debug(`args.tsql ${args.tsql}`);
      switch (true) {

        case (/^GO$/i.test(line)) :

          if (isSQL()) {

            new mssql.Request(vantage.pool).query(tools.compile(Batch))
            .then( (results) => {
              log.log(tools.format(results));
              BatchHistory[new Date] = Batch;
              Batch.splice(0);
            })
            .catch( (err) => {
              log.error(err.message);
              log.debug(err.stack);
            });

          }

          break;

        case (/^QUERY$/i.test(line)) :

          log.log(tools.format(Object.keys(queries).join('\n')));

          break;

        case (/^QUERY$/i.test(args.tsql[0])) :
          let key = args.tsql[1];
          log.debug(`key ${key}`);
          if (queries[key]) {
            let query = queries[key]
            Batch.splice(0);
            Batch.push(`-- ${line}`);
            if (typeof query=='string') {
              query.split('\n').forEach( function(line) {
                Batch.push(line);
              });
              log.debug(tools.format(Batch));
            }
          } else {
            log.warn(`unknown query ${key}`);
          }

          break;

        case (/^RUN$/i.test(line)) :

          if (isSQL()) {

            new mssql.Request(vantage.pool).batch(tools.compile(Batch)).then( (results) => {
              log.log(tools.format(results));
              BatchHistory[new Date] = Batch;
              Batch.splice(0);
            });

          }

          break;

        case (/^SCRIPT$/i.test(line)) :

          return fs.readdirAsync(path.resolve(__dirname, config.scriptPath))
          .then((scripts) => {

            log.log(tools.format(scripts.join('\n')));

          })
          .catch((err) => {
            log.error(err.message);
            log.debug(err.stack);
          });

          break;

        case (/^SCRIPT$/i.test(args.tsql[0])) :

          return fs.readFileAsync(path.resolve(__dirname, config.scriptPath, line.split(' ')[1]), 'utf8')
          .then((script) => {

            if (typeof script=='string') {
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

          if (isSQL()) {
            log.debug(tools.format(Batch));
          };

          break;

        default:

          Batch.push(line);

          break;
      }

      callback();

  });

module.exports = exports = vantage;
