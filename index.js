//// local
const config = require('./config.json');
const vantage = require('./commands');
const lib = require('./lib');

var log = vantage.logger;

log.debug(tools.format(config.docker));
log.log(lib.bandAid);

vantage.exec('instance');
