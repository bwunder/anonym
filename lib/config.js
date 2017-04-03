const path = require('path');
module.exports = {
  auth: {
    users: [
        { user: 'jack', pass: 'cheese'},
        { user: 'jill', pass: 'crackers'},
      ],
    retry: 3,
    retryTime: 500,
    deny: 1,
    unlockTime: 3000
  },
  echoQuery: false,
  echoUI: {
    keysColor: 'cyan',
    stringColor: 'inverse'
  },
  logFilter: 'debug',
  logPath: path.join(process.cwd(), 'logs'),
  odbcPool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000 },
  odbcPath: '/opt/mssql-tools/bin',
  port: 8753,
  printDate: false,
  queryUI: {
    dash: 'magenta',
    keysColor: 'green',
    numberColor: 'yellow'
  },
  scriptPath: path.join(process.cwd(), 'scripts'),
  sqlPath: '/var/opt/mssql',
  subnet: '192.168.0.0/24',
}
