//// NPM
const colors = require('colors');
const Promise = require('bluebird');
const mssql = require('mssql');
mssql.Promise = Promise;
//// core
const childProcess = Promise.promisifyAll(require('child_process'));
//// local
const config = require(`./config.json`);
const commands = require(`./commands`);
const tools = require('./tools');
const queries = require(`./queries`);

const ignoreDirs = [];
const ignoreFiles = [];

log = commands.logger;

// most of time will know container after these two queries - restart scenario
var imageId = childProcess.execSync(`docker images ${config.docker.image}:latest --format "{{.ID}}"`).toString().trim();
var containerId = childProcess.execSync(`docker ps --format "{{.ID}}" --filter=ancestor=${imageId}`).toString().trim();

if (!containerId) { // container either isn't started or doesn't exist
  if (!imageId) { // host doesn't seem to have an image - init scenario

    log.warn(`database container for image ${imageId} not started`)

    childProcess.execAsync(`docker pull ${config.docker.image}`)
    .then( function() {
//need to stop existing if before running new image
// detatch user dbs
// stop sql server
      imageId = childProcess.execSync(`docker images ${config.docker.image}:latest --format "{{.ID}}"`)[0].toString().trim();
      commands.exec(`server -i RUN`);
      containerId = childProcess.execSync(`docker ps --format "{{.ID}}" --filter=ancestor=${imageId}`).toString().trim();
// attach user dbs
    })
    .catch(function(err) {
      log.error(err);
      process.exit(1);
    });

  } else { // wiered state scenarios
    log.warn('no container found for latest image');

    // is a different image in use
    containerId = childProcess.execSync(`docker ps --format "{{.ID}}" --filter "volume=${config.docker.sqlVolume}"`).toString().trim();
    if (!containerId) {
      // get the last one created kick it off usung latest
      containerId = childProcess.execSync(`docker ps -l --format "{{.ID}}" --filter "volume=${config.docker.sqlVolume}"`).toString().trim();
      childProcess.execSync(`docker container start ${containerId}`);
    } else {
      // use the imageIdiof running - let same process happen at every restart until resolved
      log.log(childProcess.execSync(`docker inspect ${containerId}`));
      log.debug(`Adopt existing volume occupant image ${imageId} container ${containerId}  `);
    }

  }

}
log.debug(`index.js image ${imageId} container ${containerId}`);
commands.imageId = imageId;
commands.containerId = containerId;

pool = new mssql.ConnectionPool({
   user: config.sql.sa.name,
   password: config.sql.sa.password,
   server: config.cache.Switch.S,
   database: config.cache.Switch.d,
   pool: config.odbc.pool
 }, (err) => {

  if (err) log.error(err);
   
  log.log(colors.rainbow(commands._banner));

  if (config.showInfoAtStartup) {

    pool.request().query(queries.getVersion).then( function(results) {

      results.recordsets.forEach(function(rs) {
        log.log(tools.gigo( [ results.recordset ] ));
      });

    })
    .catch( (err) => {
      log.error(err.message);
      log.debug(err.stack);
      log.warn([`Use SERVER to troubleshoot the SQL Server connection`,
        `  1. is Docker running? 'SERVER'`,
        `  2. is there a local Docker SQL Server on Linux image tagged 'latests'? SERVER -i`,
        `  3. Has a container been created from that image? is that container running? SERVER -c,`,
        `  4. is the SQL Server database engine running? SERVER -s (gets you to MSSQL-CONF)`,
        `'SERVER -c START' uses container, 'SERVER -i RUN' makes new container from image`].join('\n'));
    });

    let names=[];
    commands.commands.forEach( (command) => {
      if (command._name) {
        names.push(command._name);
      }
    });

    log.info(tools.commandAid(names));

  }

});

pool.on('error', err => {
  tools.log.error(err.message);
  tools.log.debug(err.stack);
});
