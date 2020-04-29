//// NPM
const simpleGit = require('simple-git/promise')
//// CORE
const path = require('path')
//// LOCAL
const { format, log } = require('../lib/log')
const { words } = require('../lib/store')

const { appRepo } = require('../package.json')
const config = require('../config/config.json')

const git = simpleGit(process.cwd())

const remote = `https://${config.git.user}:${Promise.resolve(words.getLast('remote'))}@${config.git.origin}`;

module.exports = repo = {
  commit: async (commitComment=`autocommit at shutdown`) => {
    if (!await git.checkIsRepo()) {
      log('error', `would have run newLocal` )
      //await repo.newLocal()
    } 
    return git.add('.')
    .then( (result) => {  
// TODO !!! prompt for comment  !!!     
      return git.commit('Changes detected at anonym shutdown')
    })
    .catch( err => log('error', `(commitChanges) error\n${format(error)}`))  
  },  
  git,  
  newLocal: async () => {
    if (!await git.checkIsRepo()) {
      await git.addConfig('user.name', config.git.user)
      await git.addConfig('user.email', config.git.email)
      await git.init(process.cwd())
      await git.addRemote('origin', config.git.origin)
      ///////await git.fetch() // fetch will overwrite local
    }              
  },
  push: async (origin=config.git.origin) => {
    try {
      if (origin && (await repo.git.status()).ahead>0) {
        if (await git.getRemote()) await git.push('origin', 'master')
        log('log', `tracked changes pushed`)
      }  
    }
    catch(err) {
      log('error', `(push) error \n${format(err)}`)
    }
  }

}
