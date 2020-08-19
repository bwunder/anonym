//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { interactiveShell } = require('../api')
const catalog = require('../catalog')
const { dft } = require('../viewer')
const { format, log } = require('../log')

module.exports = container = {
  description: `SQL Server Docker Containers`,
  args: {
    action: {
      all:       `Docker API object of all Containers in the catalog`,
      bash:      `Open a bash shell prompt inside a Container`,
      commit:    `Save a Container as an Image (for redeployment)`,
      delete:    `Delete a stopped Container`,
      full:      `${dft()} Show a Container's Docker API object`,
      inspect:   `Inspect the Docker Container`,
      last:      `Last n Container(s) created, if no n is given, two are shown`,
      name:      `Add or Change a Container's name`,
      new:        chalk`Instantiate a Container (same as {bold.inverse image run})`,
      processes: `Show a Container's running processes`,
      restart:   `Restart a Container`,
      start:     `Start an idle Container`,
      stop:      `Stop a running Container` 
    }
  },
  dispatch: async args => {
    if (await catalog.isHost()) {
      switch(args.action) {
        case ('all'):
          log('log', catalog.listInstances())
          break
        case ('bash'):
          await interactiveShell()
          break
        case ('commit'):
          await catalog.commitContainer()
          break
        case ('delete'):
          await catalog.removeInstance()
          break
        case ('inspect'):
          log('log', await catalog.inspectContainer())
          break
        case ('last'):
          if (Number.isNaN(args.last)) 
          log('log', await catalog.latestInstances(Number.isNaN(args.last)? 2: args.last))
          break
        case ('name'):
          catalog.renameInstance()
          break
        case ('new'):
          await catalog.runImage()
          break
        case ('processes'):
          log('log', await catalog.getProcesses())
          break
        case ('restart'):
          await catalog.restartInstance()
          break
        case ('start'):
          await catalog.startInstance()
          break
        case ('stop'):
          await catalog.stopInstance()
          break
        case ('full'): 
        default:  
          log('log', await catalog.getInstanceInfo())
          break
      }
    }  
  }
}  
