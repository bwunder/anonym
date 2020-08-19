//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { spawnTask } = require('../api')
const catalog = require('../catalog')
const { log } = require('../log')
const { dft } = require('../viewer')

const config = require('../../config/config.json')

module.exports = {
  description: `Local Microsoft SQL Server Images pulled from hub.docker.com`,
  args: {
    action: {
      '':          `${dft()} Catalog Object of the Target's Container`,    
      all:       `All local Images`,
      available: `Images available (opens in browser)`,
      delete:    `Remove an image`,
      full:      `Full definition of the Catalog Object for a selected Image`,
      pull:      `Pull latest image from docker hub when newer`,
      run:       `Create and start new Container using current config.json settings and a selected Image`
    },  
    option: {}
  },
  dispatch: async args => {
    if (await catalog.isHost()) {
      switch (args.action) {
      case ('all'):
        log('log', catalog.listImages())
        break
      case ('available'):
        await spawnTask(`${config.browser.command} ${config.mssql.repo.availableTags}`)
        break
      case ('delete'):       
        await catalog.removeImage()
        break  
      case ('pull'):
        await catalog.pullImage()
        break
      case ('run'):
        await catalog.runImage()
        break
      case ('full'):
        log('log', await catalog.getImage(await catalog.chooseImageId()))
        break
      default:
        log('log', await catalog.getImage(catalog.sql.ContainerInfos.get(catalog.sql.Instance).ImageID))
        break
      }
    }
  }
}  
