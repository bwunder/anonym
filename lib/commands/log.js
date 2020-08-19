//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { chooseInstanceId, choosePoolId, inspectContainer, isHost, tailLog } = require('../catalog')
const { log } = require('../log')
const { readLog } = require('../sqldb')
const { dft } = require('../../lib/viewer')

const config = require('../../config/config.json')

module.exports = {
  description: chalk`Container Logs\n
    Use the {bold xp_readerrorlog} SQL Server extended stored procedure to read SQL Log 
    files stored in the container else read slightly more info but with fewer 
    filtering options than the extended proc from the Container's log via the 
    Docker API.
    
    The config.docker.tail.settings are internally passed to Docker whenever 
    reading Container logs. {bold xp_readerrorlog} params are passsed to SQL Server by 
    position as:
      o_____________________________________________________________________o
      || opt | pos | option       |    input  value   |    default  value    ||
      ||=====================================================================||
      ||  1  |  3  |  find1       |  find-string      |  empty (all)         ||
      ||  2  |  4  |  find2       |  find-string      |  empty (all)         ||
      ||  3  |  2  |  agent       |  include keyword  |  SQL Server          ||
      ||  4  |  5  |  since       |  start-date-time  |  empty (oldest)      ||
      ||  5  |  6  |  until       |  end-date-time    |  empty (latest)      ||
      ||  6  |  7  |  descending  |  include keyword  |  ascending by date   ||
      ||  7  |  1  |  extention   |  log file .ext #  |  0 (active log file) || 
      ||_____|_____|______________|___________________|______________________||
    
    Date.parce(able) UTC datetime strings are exactly that. Date strings that can 
    parsed by Javascript's Date.parce() function into numeric values that can 
    then be new'd, e.g. new Date(<numeric value<), back to the same datetime as 
    the original datetime string. Get into the the node repl or a browser's dev
    tools and try it if unsure. When true, this Date.parce(able) string will be 
    considered a valid date by this code. Note that the output datetime may not 
    have the same format as the input datetime and the time zone of the original 
    date may make the dates appear different, but the UTC datetimes will be the 
    same when thw parse works.`,
  args: {
    source: {
      docker:  `Query the Docker Container's log (these include sql errorlogs)`,      
      sql:      chalk`${dft()} Query SQL logs as {bold xp_readerrorlog} output`
    },  
    options: { 
      find1:      `Optional string to match exactly`,
      find2:      `Second optional string to match exactly`,
      agent:      chalk`Needed to Output SQL Agent Logs {italic instead of} SQL Server Logs (sql source only)`,
      since:      chalk`Date.parce(able) UTC datetime string - oldest row to show (${dft()} is container's StartedAt)`,
      until:      chalk`Date.parce(able) UTC datetime string of newest row to show (e.g., "2020-01-04T15:42:52Z")`,
      descending: `Switch to Reverse the order of log rows by date (sql source only)`,
      extention:  chalk`Optional log file archive extension {yellowBright sql source only}`,
      follow:     chalk`Boolean: Listen for and echo new log rows as written {greenBright docker source only}`,
      tail:       chalk`Number of matched rows from end of log to output {greenBright docker source only}`
    }
  },
  dispatch: async args => {
      if (await isHost()) {
        let containerId
        let source = args.source||'sql'
        switch (source) {
          case ('docker') :
            if (args.options.extention) log('warn', chalk`Ignoring {bold --extention}`)      
            if (args.options.agent) log('warn', chalk`Ignoring {bold --agent}`)      
            if (args.options.descending) log('warn', chalk`Ignoring {bold --descending}`)      
            let logConfig = config.docker.tail.settings
            containerId = await chooseInstanceId('up') 
            let state = (await inspectContainer(containerId)).State
            if (args.options.tail) logConfig.tail= args.options.tail? args.options.tail: "all"
            logConfig.since=(new Date(args.options.since? args.options.since: state.StartedAt)).toISOString()
            if (args.options.until) logConfig.until=new Date(args.options.until) 
            await tailLog(containerId, `data`, logConfig)  
            break
          case ('sql') :
            if (args.options.follow) log('warn', chalk`Ignoring {bold --follow}`)      
            if (args.options.tail) log('warn', chalk`Ignoring {bold --tail}`)      
            containerId = await choosePoolId()    
            await readLog(containerId, args.options)
            break
          default :
            log('warn', chalk`unrecognized source: ${args.source}`)
          break  
      }
    }
  }
}
