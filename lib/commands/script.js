//// NPM
const chalk = require('chalk')
//// CORE
const path = require('path')
//// LOCAL
const api = require('../api')
const { format, log } = require('../log')
const { dft } = require('../viewer')

const config = require('../../config/config.json')

module.exports = {
  description: chalk`File System stored T-SQL scripts\n 
  Uses files from the configured scripts folder 
    {italic config.cli.scripts.path}: '${config.cli.scripts.path}'
  Filtered for the configured script file extension 
    {italic config.cli.scripts.filter}: '${config.cli.scripts.filter}'
  Scripts are archived into the 'scripts' nedb collection`,
  args: {
    action: {
      archive:  `Save a copy of all scripts in the scripts folder to the scripts archive`,
      backup:   `Save a copy of a selected script to the scripts archive`,
      browse:   `Open a selected script in the browser`,
      develop:  `Open a selected script in the configured IDE: '${config.ide}'`,
      edit:     `Open a selected script in the configured editor: '${config.editor}'`,
      get:      `Display a script from the 'scripts' folder (Read Only, does not touch cache)`,
      load:     `${dft()} Load a script from the 'scripts' folder to the Batch cache`,
      new:      `Create a new script file`,  
      restore:  `Show a script from the 'scripts' archive (no load to batch cache)`,
      save:     `Save the current batch in cache to a script file)`
    },  
    filter: {
      'default': config.cli.scripts.filter,
    },
    option: {}
  },
  dispatch: async args => {
    let scriptName
    let text
    let filter = config.cli.scripts.filter
    let path = config.cli.scripts.path
    let available = await api.listFiles(path.resolve(path), filter)
    // for (let name of available) {
    //   if (!args.filter || name.startsWith(args.filter)) {
    //     available.push(name.replace(filter, ``))
    //   }
    // }  
    switch (args.action) {
      case ('archive'):
        for (let name of available) {
          text = await api.fileToJSON(path.resolve(path, name + filter))
          store.scripts.put(name, text)
        }  
        break
      case ('backup'): 
// !!! ??? needs to be a checked list... They are in the repo too
        scriptName = await api.choose(available, 'Script to save (upsert) into archive')
        store.scripts.upsert(scriptName, await fileToJSON(path.resolve(path, scriptName, filter)))
        break
      case ('browse'): 
        scriptName = await api.choose(available, 'Script to open in browser')
        doc = await view.highlightSource(path.resolve(path, scriptName.concat('.sql'))) 
        await api.spawnTask(`${config.browser.command} ${doc}`)
        break
      case ('develop'):
        if (config.ide) {
          scriptName = await api.choose(available, `Script to develop (opens in '${config.ide}')`)
          await api.spawnTask(`${config.ide} ${path.resolve(path, scriptName + filter)}`)
        } else log('warn', 'no IDE configured')
        break
      case ('edit'):
        scriptName = await api.choose(available, `Script to edit (opens in '${config.editor}'`)
        await api.editFile(path.resolve(path, scriptName + filter))
        break
      case ('get'):
        scriptName = await api.choose(available, 'Script to display (does not touch Batch)')
        log('log', await api.fileToJSON(path.resolve(path, scriptName + filter)))
        break
      case ('new'):
        if (config.ide) {
          scriptName = await api.input(`New script name (opens in '${config.ide}')`)
          await api.spawnTask(`${config.ide} ${path.resolve(path, scriptName + filter)}`)
        } else log('warn', 'no IDE configured')
        break
      case ('restore'):
        scriptName = await api.choose(await store.scripts.listNames(), 'Select script to display without spoiling the Batch')
        break
      case ('save'):
        log('log', await api.jsonToFIle(path.resolve(path, scriptName + filter)))
        break
      case ('load'):
      default:
        scriptName = await api.choose(available, 'Select script to load to Batch cache')
        await api.fileToBatch(path.resolve(path, scriptName))
        break
    }
  }
}  

