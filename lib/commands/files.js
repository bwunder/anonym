//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { input } = require('../api')
const { chooseInstanceId, cmdAttached, isHost } = require('../catalog')
const { log } = require('../log')
const { dft } = require('../viewer')

const config = require('../../config/config.json')

module.exports = files = {
  description: chalk`List files by source type found in a SQL Server Container\n
    Path guidance from the Container's environment are suggested when locating 
    the Container folders hosting files of the requested type. The current paths
    from config.json are presumed in use on all local SQL Server Containers and 
    environment variables in the container's are set to config values when 
    created. Use the {bold.inverse container bash} command to interrogate other paths and file-
    types at the container's shell prompt.`,
  args: {
    type: {
      agent    :  `SQL Agent logs in '${config.mssql.env.MSSQL_ERRORLOG_DIR}'`,
      backup   :  `SQL Backups ('.bak' files) in '${config.mssql.env.MSSQL_BACKUP_DIR}'`,
      bin      :  `SQL Executables in '${config.mssql.env.MSSQL_BIN_DIR}'`,
      dump     :  `SQL Dump files in '${config.mssql.env.MSSQL_DUMP_DIR}'`,
      data     :  `SQL Data files (.mdf) in '${config.mssql.env.MSSQL_DATA_DIR}'`, 
      errorlog :  `${dft()} SQL Errorlog logs in '${config.mssql.env.MSSQL_ERRORLOG_DIR}'`,  
      log      :  `SQL Log files (.ldf) in '${config.mssql.env.MSSQL_LOG_DIR}'`, 
      private  :  `Mirror of app's ./private folder at '${config.mssql.env.PRIVATE_DIR}'`, 
      staging  :  `Mirror of app's ./staging folder at'${config.mssql.env.STAGING_DIR}'`
    }
  },
  dispatch: async args => {
    if (await isHost()) {
      let folder, matchPattern, result
      let containerId = await chooseInstanceId('up')
      switch(args.type) {
      case ('agent'):
        folder=config.mssql.env[`MSSQL_ERRORLOG_DIR`]
        matchPattern='sqlagent'
        break
      case ('backup'):
        folder=config.mssql.env[`MSSQL_BACKUP_DIR`]
        matchPattern='.bak'
        break
      case ('bin'):
        folder=config.mssql.env[`MSSQL_BIN_DIR`]
        matchPattern=''
        break
      case ('dump'):
        folder=config.mssql.env[`MSSQL_DUMP_DIR`]
        matchPattern='core'
        break
      case ('data'):
        folder=config.mssql.env[`MSSQL_DATA_DIR`]
        matchPattern='.mdf'
        break
      case ('log'):
        folder=config.mssql.env[`MSSQL_LOG_DIR`]
        matchPattern=`.ldf`
        break
      case ('private'):
        folder=config.mssql.env[`PRIVATE_DIR`]
        matchPattern=''
        break
      case ('staging'):
        folder=config.mssql.env[`STAGING_DIR`]
        matchPattern=''
        break
        case ('errorlog'):
        default:
          folder=config.mssql.env[`MSSQL_ERRORLOG_DIR`]
          matchPattern='errorlog'
          break
      }
      if (matchPattern) {
        folder = await input('Path in container to search', folder)
        matchPattern = await input(`Find files matching`, matchPattern)
        result = await cmdAttached(containerId, `ls -lb ${folder}`)
        log('log', `typeof result ${typeof result}`) 
        log('log', result) 
      } 
    }
  }
}  

