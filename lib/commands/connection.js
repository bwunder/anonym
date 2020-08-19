//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { interactiveShell } = require('../api')
const catalog = require('../catalog')
const { pools } = require('../store')
const { dft } = require('../viewer')
const { format, log } = require('../../lib/log')

module.exports = connection = {
  description: chalk`CLI to SQL Server Connection Pools\n
    Work with the CLI's collection of open tedious.js connections to running SQL 
    Containers. The CLI prompt uses one pool at a time: the designated {bold target}. 
    Once a {bold target} is set, the CLI will try to reconnect to that {bold target} at start
    -up. However, a new TDS pool can be instantiated or an exisiting pool can be 
    reattached with {bold.inverse connection open} or when the user sets the target (e.g., 
    {bold.inverse connection target}). In either situation, any pools opened previous in the 
    current CLI session will remain open until the CLI is exited, the pool is 
    closed (e.g., {bold.inverse connection close}) or the pool is archived (e.g., {bold.inverse connection 
    forget}). The user can re-target any open pool that appears in the catalog 
    at any time during the current CLI session (e.g., {bold.inverse connection target}). 
    (Use SQL Server Linked Servers for any distributed query requirements)
    The current Batch cache contents can be directed toward an open pool other 
    than the target by using the ({bold --pool} option of any {yellowBright Terminating} command: 
      {bold.inverse go}, {bold.inverse run}, {bold.inverse sqlcmd}, {bold.inverse stream}
      {bold.inverse batch issql} uses the current Target SQL Server exclusively.`,
  args: {
    action: {
      close  :  `Close a Connection Pool`,
      edit   :  `Modify a Connection Pool Config`,
      forget :  `Forget a Connection Pool Config (will not be reused)`,
      open   :  `(Re)Open a connection Pool to a running Container`,
      target :  `Set a Container as the Target of CLI queries`, 
      ''     :  `${dft()} Inspect Connection Pool of the current Target`
      } 
  },
  dispatch: async args => {
    if (await catalog.isHost()) {
      let containerId
      switch(args.action) {
        case ('close'):
          containerId = await catalog.choosePoolId()
          await catalog.closeInstance()
          await catalog.intern()
          break
        case ('edit'):
          // load the nedb record into emacs DO NOT USE BATCH - like 'settings config' or 'script get'
          api.editText(await pools.get(await catalog.choosePoolId()))
          .then( (containerId, pool) => {
            pools.update(containerId, pool)
          })
          break
        case ('forget'):
          containerId = await catalog.choosePoolId()
          await catalog.closeInstance(containerId)
          pools.archive(containerId)
          await catalog.intern()
          break
        case ('open'):
          // resist double pooling an instance from cli by removing already pooled from choices
          const poolFilter = (available) => {
            for (let pool of Array.from(catalog.sql.Pools.keys())) {
              available.splice(available.indexOf(pool),1)
            }  
          }
          containerId = await catalog.chooseInstanceId('up', poolFilter)
          break
        case ('target'):
          await catalog.intern(await catalog.chooseInstanceId('up')) 
          break
        default:  
          log('log', `Target Container: ${catalog.sql.Instance}`)
          break
      }
    }
  }
}  
