const sqlpad = require('sqlpad')
const confg = require('../config/config.json')
const options = require('../config/sqlpad.json')

module.exports = {

  server: {},  
  start: async (credsPath) => {

    return new Promise( async(resolve, reject) => {
      try {
        let args = []
        if (!sqlpad.sqlpad) resolve()
        await api.genCertificate('sqlpad', 'serverAuth', sqlpad["cert-passphrase"])
        options["key-path"] = `${path.join(credsPath, options.key)}`
        options["cert-path"] = `${path.join(credsPath, options.cert)}`
        Object.keys(options).forEach( key => {
          if (options[key]) {
            args.push( key.length==1? `-${key}`: `--${key}` )
            args.push( options[key])
          }
        })
        sqlpad.sqlpad = spawn('sqlpad', args)
        sqlpad.sqlpad.on('error',  err => {
          api.log('error', chalk`{cyan.bold (sqlpad)} {red error}`)
          api.log('error', err)
        })
        sqlpad.sqlpad.stdout.on('data', data => {
          if (/Welcome/.test(data)) {            
            config.sqlpad.protocol= data.toString().includes('https:')?'https':'http'
            resolve(api.log('log', chalk.cyan.bold(data) +
              chalk`\n{bold (sqlpad)} browser wih V8 is required (e.g., Chrome or Chromium)`))
            } else {
            if (sqlpad.debug) {
              api.log('debug', chalk`{cyan.bold (sqlpad)} {gray ${data}}`)
            }
          }
        })
        sqlpad.sqlpad.stderr.on('data', err => {
          api.log('log', chalk`{cyan.bold (sqlpad)}  {red error}\n${err}`)
        })
        sqlpad.sqlpad.on('exit', code => {
          api.log('warn', chalk`{cyan.bold (sqlpad)} {gray server has exited} code: ${code||0}`)
          sqlpad.sqlpad={}
        })  
      }
      catch(err) {
        api.log('error', `(startSQLPad) error`)
        reject(err)
      }
    })

  }

}