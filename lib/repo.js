//// NPM
const simpleGit = require('simple-git/promise')
//// CORE
const path = require('path')
//// LOCAL
const { input } = require('../lib/api')
const { format, log } = require('../lib/log')
const { words } = require('../lib/store')
const { name } = require('../lib/viewer')

const { appRepo } = require('../package.json')
const config = require('../config/config.json')

const git = simpleGit(process.cwd())

module.exports = repo = {
  commit: async (comment) => {
    if (!await git.checkIsRepo()) {
      log('error', `${name} git repository not found.` )
      return
    } 
    return git.add('.')
    .then( (result) => {  
      const coment = input('Commit comment', `Changes to ${name} repo detected`)
      return git.commit(comment)
    })
    .catch( err => log('error', `(commitChanges) error\n${format(err)}`))  
  },  
  git,  
  newLocal: async () => {
    if (!await git.checkIsRepo()) {
      await git.addConfig('user.name', config.git.user)
      await git.addConfig('user.email', config.git.email)
      await git.init(process.cwd())
      await git.addRemote('origin', config.git.origin)
      //??? await git.fetch() or git.clone() // overwrite local
    }              
  },
  push: async (user, phrase, origin) => {
    try {      
      const remote = `https://${user}:${phrase}@${origin}`;
      if (origin && (await repo.git.status()).ahead>0) {
        if (await git.listRemote()) {
          await git.push(remote, 'master')
        }  
        log('log', `tracked changes pushed`)
      }  
    }
    catch(err) {
      log('error', `(push) error \n${format(err)}`)
    }
  }

}
