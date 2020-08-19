//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { listFiles, mssqlConf } = require('../api')
const { log } = require('../log')
const { genCertificate, hotelJuliet } = require('../tls')
const { dft, name } = require('../viewer')

const config = require('../../config/config.json')

module.exports = {
  description: chalk`TLS Credentials\n
  Generate TLS credentials and store as .pem files in the ${name()}'s '/private' subfolder.
  New credentials immediately overwrite those in use by the CLI or SQLPad socket. A restart of the
  socket is necessary for resolution. {yellowBright No restarts are conducted by this command.}`,
  args: {
    socket: {
      '':        `${dft()}) The existing collection of {bold ${name()}} TLS certificates`, 
      docker:    `The Docker daemon API`,
      sqlpad:    `The SQLPad Web Server`,
      sqlserver: `SQL Server Query Engine Connections`
      },  
    option: { 
      clientAuth: chalk`Use for CLI TLS Client Authentication (${dft()} is 'serverAuth') `,
      hotelJuliet: chalk`Remove and regenerate all credentials, including the 'ca'`
    }
  },
  dispatch: async args => {
    if (args.option.hotelJuliet) {
      hotelJuliet()
    } else if (['docker', 'sqlpad', 'sqlserver'].includes(args.socket)) {
      if (args.option.clientAuth) {
        await genCertificate(`${args.socket}CLI`, 'clientAuth')
      } else {
        await genCertificate(args.socket, 'serverAuth')
      }
    } else {
      log('log', (await listFiles('private', args.socket || '.pem')).join('\n'))
      await mssqlConf(catalog.sql.Instance, '-h')
    }
  }
}
