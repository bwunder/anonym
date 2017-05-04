"use strict;"
const Vantage = require('vantage');
const vorpalLog = require('vorpal-log');
const config = require('./config');

//http socket
vantage = new Vantage();

vantage
 .use( vorpalLog, { printDate: true } )
 .delimiter( "test~$" )
 .listen( config.vantage.port+1 )
 .show();

const log = vantage.logger;

vantage.connect(`127.0.0.1 ${config.vantage.port}`)
.then( (host) => {
  log.debug(host);
  return host.exec('config');
})
// .then( (data) => {
//   log.debug(data);
//   return vantage.exec('config --container')
// })
// .then( (data) => {
//   log.debug(data);
//   return vantage.exec('config --config')
// })
// .then( (data) => {
//   log.debug(data);
//   return vantage.exec('config --mssql')
// })
// .then( (data) => {
//   log.debug(data);
//   return vantage.exec('config --sqlpal')
// })
// .then( (data) => {
//   log.debug(data);
//   return vantage.exec('config --sqlserver')
// })
.then( (data) => {
  log.debug(data);
  return vantage.exec('exit');
})
.then( (data) => {
  log.info(`exited normally`);
})
.catch((e) => {
  log.error(e);
});
