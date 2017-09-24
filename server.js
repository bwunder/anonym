// core
const childProcess = require('child_process');
const colors = require('colors');

const config = require(`./config.json`);
const cli = require(`./commands.js`);
const lib = require(`./lib.js`);

const sqlpadArgs = [];
if (config.logLevel===10) {
  config.sqlpad.debug=true;
} else {
  config.sqlpad.debug=false;
};
Object.keys(config.sqlpad).forEach( (key) => {
  if (config.sqlpad[key]) {
    sqlpadArgs.push( key.length==1? `-${key}`: `--${key}` );
    sqlpadArgs.push( config.sqlpad[key]);
  }
});

const sqlpad = childProcess.spawn('sqlpad', sqlpadArgs);

sqlpad.stdout.on('data', (data) => {
  if (/welcome to sqlpad/i.test(data)) {
    lib.log( 'log', `${data}`.yellow );
  } else {
    lib.log( 'debug', `sqlpad `.cyan.italic + `${data}`.gray);
  }
});

sqlpad.stderr.on('data', (data) => {
  lib.log('log', `sqlpad `.cyan.italic + `error `.magenta.bgWhite + `${data}`.red);
});

sqlpad.on('exit', (code) => {
  lib.log('log', config.log);
  lib.log('warn', `sqlpad `.cyan.italic + `server exited with code ${code}`);
  lib.log('',cli);
});

process.on('error', (err) => {
  lib.log('warn', 'process error handler (thew itself in the garbage can)');
  lib.log('error', err);
  process.exit(1);
});

process.on('exit', (code) => {
  if (typeof sqlpad!='undefined'){
    sqlpad.kill();
  }
  if (config.tail){
    config.tail.kill();
  }
});
