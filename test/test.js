
const config = require('../config.json')
const api = require('../api.js')

const cli = module.parent.exports
module.exports=exports=test={
  config: () => {

    api.log('debug',`list current sqlpal configution`)
    api.log('debug', module.parent)
//    cli.exec('help')
    // commands.exec(`config`)
    //
    // api.log(`edit sqlpal configution file`)
    // commands.exec(`config --all`)
    // if (!config.editor) {
    //   api.log('warn', `no code editor configured`)
    // } else {
    //   commands.exec(`config -a e`)
    // }
    //
    // api.log(`show `)
    // commands.exec(`config --file`)
    //
    // commands.exec(`config --mssql`)
    //
    // commands.exec(`config --mssql xp_cmdsh`)

  }

}
