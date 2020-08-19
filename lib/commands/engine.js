//// NPM
//// CORE
//// LOCAL
const { setEngine } = require('../api')
const { dft } = require('../viewer')
const { log } = require('../log')

module.exports = engine = {
  description: `dockerd Engine - Self-sufficient runtime for containers
  This command tries to be a light weight wrapper for the Docker API
  `,
  args: {
    action: {
      reload :  `Reload config - will not restart the daemon`,
      restart:  `Restart the daemon and running Target`,
      start  :  `Start stopped Docker daemon and Target Instance`,
      status :  `${dft()} Status of the Docker daemon`,
      stop   :  `Stop the running daemon - stops all containers`, 
    },  
    start: { 
      all    : `Start all instances after engine starts`,
      none   : `Do not [re-]start any instances, only the engine`,
      running: `Also re-start the now running instances when engine re-starts`,
      target : `${dft()} [Re-]start only the Target at engine [re-]start`
    }
  },
  dispatch: async args => {
    const action = args.action || 'status'
    const option = Object.keys(args.start)[0] || 'target'
    if (!args || Object.keys(engine.args.action).includes(action)) {
      await setEngine(action, option)
    } else {
      log('warn', `Invalid request`)
    }
  }
}