//// NPM
const simpleGit = require('simple-git/promise')
//// CORE
const path = require('path')
//// LOCAL
const { confirm, input } = require('../lib/api')
const { format, log } = require('../lib/log')
const { words } = require('../lib/store')
const { name } = require('../lib/viewer')

const { appRepo } = require('../package.json')
const config = require('../config/config.json')

const git = simpleGit(process.cwd())

module.exports = repo = {
  commit: async (comment) => {
    if (!await git.checkIsRepo()) {
      log('error', `${name()} git repository not found.` )
      return
    } 
    const status = await git.status()
    for (const key of Object.keys(status)) {
      if (Array.isArray(status[key]) && status[key].length>0) {
        log('log', status)
        break
      }
    }  
    if (await confirm(`Commit changes to ${name()} repo now?`)) {
      return git.add('.')
      .then( async () => {  
        const comment = await input('Commit comment', `Changes to ${name()} repo detected at startup`)
        return await git.commit(comment)
      })
      .catch( err => log('error', `(commitChanges) error\n${format(err)}`))  
    }
  },
  git, 
  push: async (user, phrase, origin) => {
    try {      
      const remote = `https://${user}:${phrase}@${origin}`;
      if (origin && (await git.status()).ahead>0) {
        if (await confirm(`Push changes to '${origin}' now?`)) {
          if (await git.listRemote()) {
            await git.push(remote, 'master')
          }  
          log('log', `tracked changes pushed`)
        }  
      }  
    }
    catch(err) {
      log('error', `(push) error \n${format(err)}`)
    }
  }
}
