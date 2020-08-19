//// NPM
const chalk = require('chalk')
//// CORE
//// LOCAL
const { confirm } = require('../api')
const { format, log } = require('../log')
const repo = require('../repo')
const { dft } = require('../viewer')

const config = require('../../config/config.json')

module.exports = {
  description: `Source control using simple-git API`,
  args: {
    action: {
      add:     `Stage file system changes into local repo`,
      commit:  `Accept staged changes`,
      fetch:   `Bring all changes at remote into local repo`,
      init:    `Initialize a new local repo`,
      merge:   `Merge remote and local repo`,
      reset:   `Un-stage all staged files`,
      rebase:  `Rebase archive`,
      remote:  `URL with authentication for remote`,
      push:    `Move all committed changes from local into remote`,
      status:  `${dft()} Display object showing all changes to local repo`
    }
  },
  dispatch: async args => {
    let choice
    if (args.action && !['remoteURL', 'status'].includes(args.action)) {
      log('log', `Local repo state before ${args.action}:\n${format(await repo.status())}`)
    }  
    switch (args.action) {
      case ('add'):
        await repo.add()
        break
      case ('commit'):
        await repo.commit()
        break
      case ('fetch'):
        await repo.fetch()
        break
      case ('init'):
        await repo.init()
        break
      case ('merge'):
        await repo.merge()
        break
      case ('push'):
        if (await confirm(`API push does not reset 'git statusSummary.ahead' counter\nBetter to use 'git push' at bash prompt instead.\nPush now anyway?`)) {
          await repo.push()
        }
        break
      case ('rebase'):
        await repo.rebase()
        break
      case ('reset'):
        await repo.reset()
        break
      case ('remoteURL'):
        log('log', await repo.remoteURL())
        break
      case ('status'):
      default:
        log('log', `Current state of local repo:\n${format(await repo.status())}`)
        break
    }
  }
}
