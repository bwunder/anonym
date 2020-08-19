//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { choose, interactiveShell } = require('../api')
const { log } = require('../log')
const sqlpad = require('../sqlpad')
const { dft, name } = require('../viewer')

const config = require('../../config/config.json')

module.exports = {
  description: chalk`Open Source SQL editor and report server for the V8 browser\n 
  Review the source - and read descriptions of all of the SQLPad container environment variables in
  SQLPad author Rick Bergfalk's SQLPad Github repo, https://github.com/rickbergfalk/sqlpad.
  SQLPad stores TSQL queries, tedious.js database connections and chart definitions for recall on 
  demand, and renders tabular or json query results as well as graphical data reports from any 
  browser built with the V8 Javascript Engine. SQLPad helps out during query composition with 
  SQL autocomplete functionality.\n 
  Modify a SQLPad container's environment variables with {bold.inverse settings sqlpad}
    -or-
  Edit the default environment variables*, e.g., set SQLPad to start with CLI start, or enable 
  TLS for the ${name()}'s SQLPad web server in file './config/config.json' ({bold.inverse settings config}).\n
  Note that SQLPad provides unix ODBC support that is unused by ${name()}. Several databases other 
  than Microsoft SQL Server can be queried through this unix ODBC protocol.`,
  args: {
    action: {
      bash:       `Open a bash command prompt in a SQLPad container`,
      containers: `Current local SQLPad container inventory`,
      images:     `Current local SQLPad image inventory`,
      map:        `Catalog of local SQLPad Docker artifacts`,
      pull:       `Fetch the latest SQLPad hub.docker.com image (if newer)`, 
      rm:         `Remove one or more SQLPad container from local inventory`,
      rmi:        `Remove one or more SQLPad image from local inventory`,
      run:        `Launch a new SQLPad container from a selected image`,
      start:      `Start SQLPad container`,
      status:     `${dft()} State of a SQLPad Container`,
      stop:       `Stop SQLPad container`,
      target:     `Current active SQLPad container`
    }
  },
  dispatch: async (args, cb) => {
    let containers = [], images = [], containerId, imageId
    switch (args.action) {
      case ('bash'):
        for (let [imageId, image] of (await sqlpad.mapImages())) {
          containers.concat(await sqlpad.mapContainers(imageId))
        } 
        containerId = await choose(containers, 'SQLPad container', containers.pop()) 
//?? not sure why I used this, may work???
        await interactiveShell(containerId)
        break  
      case ('containers'):
        log('log', sqlpad.sqlpadMap.containers.keys())
        break
      case ('images'):
        log('log', sqlpad.sqlpadMap.images.keys())
        break 
      case ('map'):
        await map()
        log('sqlpad', sqlpad.sqlpadMap)
        break 
      case ('rm'): 
        // choose from idle containers
        await sqlpad.drop()
        break
      case ('rmi'): 
        // choose from unused images
        await sqlpad.remove()
        break
      case ('run'): 
        imageId = await choose(Array.from(sqlpad.sqlpadMap.images.keys()), 
            'Create SQLPad container from image', 
            images[images.length-1])
        await sqlpad.runImage(imageId)
        break
      case ('start'):
        await sqlpad.start()
        break
      case ('stop'):
        await sqlpad.stop()
        break
      case ('status'):  
      default:
        if (!sqlpad.sqlpad) {
          log('log', chalk`SQLPad web server not attached, try {bold sqlpad start}`)
        } else {
          await sqlpad.status()
          log('log', `SQLPad Server is Running  
            PID: ${sqlpad.sqlpad.pid}
            URI: ${config.sqlpad.protocol}://${sqlpad.ip}:${sqlpad["https-port"]}`)
        }
        break
    }
  }
}
