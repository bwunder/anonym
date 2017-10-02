"use strict;"
// NPM
const colors = require('colors');
const prettyjson =  require('prettyjson');
const Promise = require('bluebird');
// core
const childProcess = Promise.promisifyAll(require('child_process'));
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
// local
const config = require('./config');

let sqlpad;

module.exports = exports = lib = {

  archiveBatch: () => {

    config.cache.batchHistory[`${lib.dateTag()}`] = config.cache.batch;
    config.cache.batch.splice(0);

  },
  archiveBatchHistory: () => {

    return fs.writeFileAsync(path.resolve(config.archivePath, lib.dateTag() + '_Batch.hist'), config.cache.batchHistory, 'utf8')
    .then(function(result) {
      lib.log('log', result);
    })
    .catch((e) => {
      lib.log('error',  e.message);
      lib.log('debug', e.stack);
    });

  },
  bandAid:[`\t ++++    ++++   ++       `.rainbow + `@@@@      @     @@`.america,
           `\t++  ++  ++  ++  ++`.rainbow + ` l Q _ `.green + `@@  @@   @@     @@`.america,
           `\t ++     ++  ++  ++`.rainbow + `   |   `.green + `@@  @@  @  @    @@`.america,
           `\t   ++   ++  ++  ++`.rainbow + `  / \\  `.green + `@@@@   @@@@@@   @@`.america,
           `\t++  ++  ++  ++  ++       `.rainbow + `@@    @@    @@  @@`.america,
           `\t ++++    ++,+   ++++++   `.rainbow + `@@   @@      @@ @@@@@`.america,
           `\t           )`.rainbow].join(`\n`),

  commandAid: (cmds) => {

    let builtins=[], names=[];

    cmds.forEach( (cmd) => {
      if (cmd._name) {
        if (['HELP', 'EXIT', 'WHO', 'VANTAGE', 'REPL', 'LOGLEVEL'].includes(cmd._name.toUpperCase())) {
          builtins.push(`${cmd._name.toUpperCase()}\t\t${cmd._description}`);
        } else {
          names.push(`${cmd._name.toUpperCase()}`.cyan + `\t\t${cmd._description}`);
        }
      }
    });
    return [
      `Input not recognized as one of these `+`KEYWORDS`.rainbow+` is buffered to an array of T-SQL lines`,
      `as a cached query Batch that is compiled to T-SQL upon termination and cleared from cache once executed`,
      `\t--HELP`.rainbow + `\t\tThis usage message (more complete than HELP command from the Vantage CLI below)`,
      `\tDEBUG`.rainbow + ` [ON|OFF] `.yellow + `\tsqlpal verbose logging mode (set vantage builtin logLevel=10)`,
      `  Injector Commands `.magenta + ' - ' + `overwrite the Batch with saved user queries`.gray,
      `\tQUERY`.magenta + ` [key] `.yellow + ` \tNamed queries as found in 'queries.js' module file`,
      `\tSCRIPT`.magenta + ` [file-name] `.yellow + `\t'.sql' files in '${config.scriptPath}' folder`,
      `  Terminating Commands`.green + ' - ' + `send the compiled Batch to SQL Server`.gray,
      `\tGO`.green + `      \tProcess Batch via pooled mssql .query(), write JSON results and clear cache if AOK`,
      `\tRUN`.green + `     \tProcess Batch via pooled mssql .batch(), write JSON results and clear cache if AOK`,
      `\tSQLCMD -[q|Q]`.green.italic + `   Vantage command below: `+`de facto`.italic+` ODBC terminator similar to GO or RUN with tabular results`,
      `\tTEST`.green + `    \tTest Batch syntax at SQL Server with SET NOEXEC ON, Batch is not cleared from cache`,
      `  Vorpal CLI Commands`.cyan,
      `     Vantage distributed realtime CLI built-ins`.gray,
      `\t${builtins.join('\n\t')}`,
      `     SQL Server for Linux Docker Image Administration`.gray,
      `\t${names.join('\n\t')}`,
    ``].join(`\n`);
  },
  compile: (cacheObject) => {

    let str=``;

    if (!Array.isArray(cacheObject)) {
      Object.keys(cacheObject).forEach((key) => {
        if (!['i', 'q', 'Q'].includes(key)) {
          str+= key.length===1? ` -${key}`: ` --${key}`;
          if (key!=cacheObject[key]) {
            str+= ` \'${cacheObject[key]}\'`;
          }
        }
      });
    } else {
      str = cacheObject.join('\n').replace(/`/g, "'");
    }
    return str;

  },
  fileToBatch: (fromFile) => {

    return fs.readFileAsync(fromFile, 'utf8')
    .then((script) => {
      if (typeof script==='string') {
        config.cache.Batch.splice(0);
        config.cache.Batch.push(`-- ${fromFile}`);
        script.split('\n').forEach( function(qline) {
          config.cache.Batch.push(qline);
        });
      }

    })
    .catch((err) => {
      lib.log('warn', `failed to read script-file`);
      lib.log('error', err.message);
      lib.log('debug', err.stack);
    })

  },
  fileToJSON: (fromFile) => {

    return fs.readFileAsync(path.resolve(fromFile))
    .then((fileBuffer) => {
      lib.log('log', lib.format(JSON.parse(fileBuffer.toString())));
      lib.log('info', `Use text editor to modify file '${path.resolve(fromFile)} then restart sqlpal for now...`);
    })
    .catch((err) => {
      lib.log('error', err.message)
      lib.log('debug', err.stack);
    });

  },
  dateTag: () => {
    return new Date().toISOString().replace(':','_');
  },
  format: (gi) => { // garbage in

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

            gi.forEach(function(result) {
              go += prettyjson.render(result);
            });

            break;

          default:
            if (gi.recordset && gi.recordsets) {
              gi.recordsets.forEach(function(rs) {
                go += prettyjson.render(rs);
              });
            } else {
              go = prettyjson.render(gi);
            }
            break;
        }
        break;

      default:

        go = `unexpected type ${typeof gi}`.inverse;
        break;

    }

    return go + '\n';

  },
  interactiveSession: (containerId) => {

    if (containerId) {

      // (re)create link files (-d detatched)
      lib.log('debug', `(ExecSync) docker exec -d ${containerId} /bin/bash
        \tdocker exec -d ${containerId} ln -sf ${config.odbc.path}/sqlcmd /usr/bin
        \tdocker exec -d ${containerId} ln -sf ${config.odbc.path}/bcp /usr/bin
        \tdocker exec -d ${containerId} ln -sf -T ${config.mssql.conf} /usr/bin/mssql-conf`);
      childProcess.execSync(`docker exec -d ${containerId} /bin/bash
        docker exec -d ${containerId} ln -sf ${config.odbc.path}/sqlcmd /usr/bin
        docker exec -d ${containerId} ln -sf ${config.odbc.path}/bcp /usr/bin
        docker exec -d ${containerId} ln -sf -T ${config.mssql.conf} /usr/bin/mssql-conf`);
      lib.log('info', [`Opening interactive session in SQL Server container ${containerId}...`,
        `'bcp, 'mssql-conf', 'sqlcmd' command-lines, and SQL Server's 'env' variables are available.`,
        `type 'exit' to close interactive session and resume sqlpal prompt`].join('\n'));
      lib.log('debug', `(spawnSync) docker exec --interactive --tty ${containerId} /bin/bash`);
      childProcess.spawnSync(`docker`, [`exec`, `--interactive`, `--tty`, `${containerId}`, `/bin/bash`], {
        stdio: ['inherit', 'inherit', 'inherit']
      });

    }

  },
  listFiles: (folder, filter) => {

    config.log.log(`list files in folder: '${folder}' filter: '${filter}'`);
    fs.readdirAsync(path.resolve(folder))
    .then((files) => {
      files.forEach( function(file) {
        if (file.includes(filter)) {
          lib.log('log', file);
        }
      });
    })
    .catch((err) => {
      lib.log('error', err.message);
      lib.log('debug', err.stack);
    });

  },
  log: (mode, data) => {

    if (typeof config.log==='undefined') {
      if (mode==='error') {
        console.error(data);
      } else {
        console.log(mode, data);
      }
      switch (mode) {
        case ('debug'):
          if (config.sqlpad.debug) {
            console.log('debug'.gray, data);
          }
          break;
        case ('error'):
          console.error(data);
          break;
        case ('info'):
          console.log('info'.blue, data);
          break;
        case ('log'):
          console.log(data);
          break;
        case ('warn'):
          console.log(`warn`.yellow, data);
          break;
      }
    } else {
      switch (mode) {
        case ('debug'):
          config.log.debug(data);
          break;
        case ('error'):
          config.log.error(data);
          break;
        case ('info'):
          config.log.info(data);
          break;
        case ('log'):
          config.log.log(data);
          break;
        case ('warn'):
          config.log.warn(data);
          break;
      }
    }

  },
  runImage: (imageId = config.docker.imageId) => {

    // not if container already running or port or volume already in use
    lib.log('debug', `(execSync) docker ps --all --filter "ancestor=${imageId}" (cfg ${config.docker.imageId})`);
    let existing = childProcess.execSync(`docker ps --all --filter "ancestor=${imageId}" `).toString();
    if (!existing) {
      let args = [
        `sudo docker run`,
        `-e "ACCEPT_EULA=${config.mssql.acceptEULA}"`,
        `-e "SA_PASSWORD=${config.mssql.sa.password}"`,
        `-p ${config.docker.hostPort}:${config.docker.sqlPort}`,
        `-v ${config.docker.sqlVolume}:${config.docker.sqlVolume}`,
        `-d ${config.docker.imageId}`].join(' ');

      lib.log('debug', `(execSync) ${args}`);
      let run = childProcess.execSync(args);

      run.on('error',  (data) => {
        lib.log('warn', `error starting container ${imageId}`);
        lib.log('error', err.message);
        lib.log('debug', err.stack);
        run.kill();
      });

    } else {
      lib.log('log', existing);
    }

  },
  setImage: (imageId) => {

    let pullInterval = 600;
    let pullDt = new Date;
    lib.log('debug', `setImage - minutes since last pull ${(Math.round(pullDt - (config.docker.lastPullDt||pullDt))/1000)/60+1}`);
    if ((typeof config.docker.lastPullDt==='undefined') || (Math.round(pullDt - (config.docker.lastPullDt||pullDt))/1000/60)>pullInterval) {
      lib.log('debug', `(spawnSync) docker pull ${config.docker.repo}`);
      childProcess.spawnSync(`docker`, [`pull`, `${config.docker.repo}`], {
        stdio: [0, (config.vantage.logLevel!=20)? null: 1, 2]
      });
      config.docker.lastPullDt = pullDt;
      // default to latest
      if (!imageId) {
        imageId = childProcess.execSync(`docker images ${config.docker.repo}:latest --format "{{.ID}}"`).toString();
        lib.log('debug', `(execSync) docker images ${config.docker.repo}:latest  --format "{{.ID}}" = ${imageId}`);
      }
    }
    config.docker.imageId = imageId || config.docker.imageId;
    if (config.docker.imageId) {
      lib.log('log', childProcess.execSync(`docker image inspect --format="{{json .Config.Labels}}" ${config.docker.imageId}`));
    }

  },
  setInstance: (containerId) => {

    try { // handled error informs but 'ps -e|grep dockerd' may be better for automating the works?
      // the most recently started running SQL Server container - !!!could be more than 1 and all will be returned!!!
      let sqinstance = childProcess.execSync(`docker ps --filter "ancestor=${config.docker.repo}" --format "{{.ID}}"`).toString().trim();
      lib.log('debug', `(execSync) docker ps --filter "ancestor=${config.docker.repo}" --format "{{.ID}}" = ${sqinstance}`);
      let sqlatest = childProcess.execSync(`docker ps --latest --filter "ancestor=${config.docker.repo}" --format "{{.ID}}"`).toString().trim();
      lib.log('debug', `(execSync) docker ps --latest --filter "ancestor=${config.docker.repo}" --format "{{.ID}}" = ${sqlatest}`);
      let sqid = containerId || sqinstance || sqlatest;
      let sqimage = childProcess.execSync(`docker ps --all --filter "id=${sqid}" --format "{{.Image}}"`).toString().trim();
      lib.log('debug', `(execSync) docker ps --latest --filter "id=${sqid}" --format "{{.Image}}" = ${sqimage}`);

      lib.setImage(sqimage);

      if (config.docker.imageId) {

        if (config.docker.imageId!=sqimage) {
          lib.log('debug', `(execSync) docker images ${config.docker.repo}`);
          lib.log('log', childProcess.execSync(`docker images ${config.docker.repo}`).toString());
          config.docker.imageId = sqimage;
        }
        if (!sqid) {
          // new instance
          if (!config.docker.imageId) {
            lib.runImage();
            lib.log('debug', `(execSync) docker ps --filter "ancestor=${config.docker.repo}" --format "{{.ID}}"`);
            config.docker.containerId = childProcess.execSync(`docker ps --filter "ancestor =${config.docker.repo}" --format "{{.ID}}"`).toString().trim();
          }
          lib.startContainer('start', sqid);
        } else {
          if (!sqinstance) {
            lib.startContainer('start', sqid);
          }
          config.docker.containerId = sqid;
          lib.log('debug', `container ${config.docker.containerId} ready`);
        }
        sqldb.openPool();
        // make this a method - also used in runImage
        lib.log('debug', `(execSync) docker ps --filter "id=${sqid}"`);
        lib.log('log', childProcess.execSync(`docker ps --filter "id=${sqid}"`).toString());

      }
    }
    catch(err) {
      lib.log('debug', `error instantiating container (was trying id: ${config.docker.containerId})`);
      lib.log('error', err.message);
      lib.log('debug', err.stack);
    }

  },
  setSqlpad: () => {

    let retry=1;

    // ??could use array and allow multiple in config.sqlpad??
    if (config.sqlpad.sqlpad) {
      config.sqlpad.sqlpad.kill();
    }
    const sqlpadArgs = [];
    if (config.logLevel===10) {
      config.sqlpad.debug=true;
      config.logLevel===10;
    };

    Object.keys(config.sqlpad).forEach( (key) => {
      if (config.sqlpad[key]) {
        sqlpadArgs.push( key.length==1? `-${key}`: `--${key}` );
        sqlpadArgs.push( config.sqlpad[key]);
      }
    });

    sqlpad = childProcess.spawn('sqlpad', sqlpadArgs);

    // ?? ocassionally (rapid restart cycles) sqlpal's queries poisons the .spawn ??
    // ENOENT: no such file or directory, rename 'data/queries.db~' -> 'data/queries.db' at Error (native)
    // a retry always resolves, perhaps a lock in a slow to close async spawn?
    sqlpad.on('error',  (data) => {
      if (!retry && err.code===`ENOENT`) {
        retry--;
        lib.log('debug', `[sqlpad]`.cyan.italic + ` retry`);
        setSqlpad();
      } else {
        lib.log('warn', `[sqlpad]`.cyan.italic + `unable to start sqlpad server`);
        lib.log('error', err);
      }
    });

    sqlpad.stdout.on('data', (data) => {
      if (/Welcome/.test(data) || (/Launching/.test(data))) {
        lib.log( 'log', `${data}`.yellow );
      } else {
        lib.log( 'debug', `[sqlpad] `.cyan.italic + `${data}`.gray);
      }
    });

    sqlpad.stderr.on('data', (data) => {
      lib.log('log', `[sqlpad] `.cyan.italic + `error `.magenta.bgWhite + `${data}`.red);
    });

    sqlpad.on('exit', (code) => {
      lib.log('log', config.log);
      lib.log('warn', `[sqlpad] `.cyan.italic + `server exited with code ${code}`);
    });

    config.sqlpad.sqlpad=sqlpad;

  },
  startContainer: (startType, containerId) => { // start or restart

    // 'start' or 'restart' the specified sql server container
    return new Promise(function(resolve) {

      lib.log('log', `${startType}ing SQL Server container ${containerId}`);
      lib.log('debug', `(execSync) docker container ${startType} ${containerId}`)
      return childProcess.execAsync(`docker container ${startType} ${containerId}`)
      .then( () => {
        lib.log('debug', `(execSync) docker ps --filter "id=${containerId}" --format "{{.Image}}"`)
        return childProcess.execSync(`docker ps --filter "id=${containerId}" --format "{{.Image}}"`)
      })
      .then( (imageId) => {
        lib.setImage(imageId);

        /***************************************************************************************/
        // process exit event may need to kill tail so we stick it on the glob fpr later use
        lib.log('debug', `(spawn) docker logs --follow ${containerId} --tail 0`);
        config.tail = childProcess.spawn('docker', [`logs`, `--follow`, `${containerId}`, `--tail`, 0]);

        config.tail.stdout.on('data', (data) => {
          lib.log('log', `tail `.cyan.italic + `${data}`.gray);
        });

        config.tail.stderr.on('data', (data) => {
          lib.log('log', `tail error `.magenta.bgWhite.italic + `${data}`.red);
        });

        config.tail.on('exit', (code) => {
          lib.log('warn', `tail of container ${containerId} SQL Server errorlog has ended with code ${code}`);
        });
        /***************************************************************************************/

      })
      .catch( (err) => {
        lib.log('debug', `error while attempting to start SQL Server container ${config.docker.containerId}`);
        lib.log('error', err.message);
        lib.log('debug', err.stack);
      });

    });

  },
  stopContainer: () => {

    lib.log('debug', `Stopping SQL Server container ${config.docker.containerId}`);
    return new Promise(function(resolve) {
      sqldb.closePool();
      lib.log('debug', `(execAsync) docker container stop ${config.docker.containerId}`);
      childProcess.execAsync(`docker container stop ${config.docker.containerId}`)
      .then( function() {
        lib.log('log', `container '${config.docker.containerId}' is closed`);
      })
      .catch( (err) => {
        lib.log('debug', `error while attempting to stop SQL Server container ${config.docker.containerId}`);
        lib.log('error', err.message);
        lib.log('debug', err.stack);
      });
    });
  }

}
