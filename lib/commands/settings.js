//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { choose, editFile, interactiveShell, sqlpadContainers, sqlpadImages} = require(`../api`)
const { chooseInstanceId } = require('../catalog')
const { log } = require('../log')
const { dft } = require('../viewer')

const config = require('../../config/config.json')

module.exports = {
  description: `Configurable Settings
    Tries to open the config file in the configured IDE. If the IDE is not 
    present locally or not configured, tries to open in the configured editor. 
    If the editor is not present, opens with vi.`,
  args: {
    purpose: {
      '':        chalk`${dft()} Review the {italic buffered} config object`,
      config:    `Open './config/config.json' file with '${config.editor}'`,
      sqlpad:    `Work with the ENVIRONMENT variables in the SQLPad Container`,
      sqlserver: `Work with the ENVIRONMENT variables in a SQL Container`,
      git:       `Open './.gitignore' with '${config.editor}'`
    },
    option: {}
  },
  dispatch: async args => {
    let containerId
    switch(args.purpose) {
      case ('config'):
        await editFile(`config/config.json`)
        break
      case ('gitignore'):
        await editFile(`.gitignore`)
        break
      case ('sqlpad'):
        let containers = []
        for (let [imageId, image] of (await sqlpadImages())) {
          containers.concat(await sqlpadContainers(imageId))
        } 
        containerId = await choose(containers, 'SQLPad container', containers.pop()) 
        await interactiveShell(containerId, 'SET')
        break  
      case ('sqlserver'):
        containerId = await chooseInstanceId('up')
        await interactiveShell(containerId, 'SET')
        break
      default:
        log('log', config)
        break
    }
  }
}

