const cli = require(`./commands.js`);
const lib = require(`./lib.js`);

lib.setSqlpad();

process.on('error', (err) => {
  lib.log('warn', 'process error handler');
  lib.log('error', err);
  process.emit('exit');
});

process.on('exit', (code) => {

  // clean-up spawned procs
  if (config.sqlpad.sqlpad) {
    config.sqlpad.sqlpad.kill();
  }
  if (config.tail) {
    config.tail.kill();
  }

  // persist session activity to archive
  // config.batchHistory
  // cli.history
  // update config.json?

});
