//// NPM
const colors = require('colors');

//// local
const config = require(`./config.json`);
const commands = require(`./commands`);
const tools = require('./tools');

log = commands.logger;

try {

  // most of time will know container after these two queries
  commands.exec(`server --image`);
  commands.exec(`server --container`);

  if (!config.docker.containerId) {

    if (!config.docker.imageId) {

      log.info(`Trying Dockerhub for the latest SQL Server for Linux Image...`)

      commands.exec(`server --pull`);
      commands.exec(`server --image`);
      commands.exec(`server --image run`);

    }

    config.docker.containerId = commands.exec(`server --container`);
    if (!config.docker.containerId) {

      log.warn(`Unable to identify a container for ${imageId}`);

    }

    commands.exec(`server --container`);

  }

  log.debug(tools.gigo(config.docker));
  log.log(colors.rainbow(tools.bandAid));
  log.log(tools.commandAid(commands.commands));

  commands.exec(`server --container connect`);

}

catch(err) {
  log.debug('error opening Docker instance');
  log.error(err.message);
  log.debug(err.stack);
}
