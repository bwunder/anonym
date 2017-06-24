//// NPM
const colors = require('colors');

//// local
const config = require('./config.json');
const commands = require('./commands');
const tools = require('./tools');

log = commands.logger;

log.debug(tools.format(config.docker));
log.log(colors.rainbow(tools.bandAid));
log.info(tools.commandAid(commands.commands));

commands.exec('server --container');
