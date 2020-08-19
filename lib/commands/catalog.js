//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { interactiveShell } = require('../api')
// 'catalog' conflicts with export object name & too many refs to destructure
const cat = require('../catalog')
const { dft } = require('../viewer')
const { log } = require('../log')

const config = require('../../config/config.json')

module.exports = {
  description: chalk`Stateful Inventory of Managed SQL Instances\n
  The catalog is a runtime Object of Maps of Docker {bold ${config.mssql.repo.path}} Objects 
  along with this CLI's SQL connections to any of the running SQL Servers in the catalog.`,
  args: {
    action: {
      all:       `Cached inventory of local SQL Server in Docker artifacts`,
      container: `Map of SQL Server containers`,
      image:     `Map of SQL Server images`,
      network:   `Map of IP assignments of running containers`,
      pool:      `Currently opened SQL Server in Docker connection pools`,
      remap:     `Force a re-inventory of local SQL Server in Docker artifacts`,
      summary:   `${dft()} Brief summary of currently cached inventory`
    }
  },
  dispatch: async args => {
    if (await cat.isHost()) {
      switch(args.action) {
        case ('all'):
          log('log', chalk.inverse(`SQL Server Images Pulled`.padEnd(26).padStart(30)))
          log('log', cat.listImages())
          log('log', chalk.inverse(`Containers Created`.padEnd(26).padStart(30)))
          log('log', cat.listInstances())
          log('log', chalk.inverse(`Pools Opened`.padEnd(26).padStart(30)))
          log('log', cat.listPools())
          break
        case ('container'):
          log('log', await cat.getInstanceInfo(await catalog.chooseInstanceId('all')))
          break
        case ('image'):
          log('log', await cat.getImage(await catalog.chooseImageId()))
          break
        case ('network'):
          log('log', cat.getAddress())
          break
        case ('pool'):
          log('log', chalk.inverse(`Pools Opened`.padEnd(26).padStart(30)))
          log('log', cat.listPools(await catalog.choosePoolId()))
          break
        case ('remap'):
          await cat.intern()
          break
        case ('summary'):
        case (undefined):
          if (cat.sql.Images) {
            await cat.paintImagesSummary() 
            await cat.paintInstancesSummary() 
            cat.paintPoolsSummary() 
          }  
          break
        default:
          log('warn', `Unknown repo action: ${args.action}`)
          break
      }
    }  
  }
}  
