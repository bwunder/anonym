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
  author: async () => {
    await git.addConfig('user.name', config.git.user)
    await git.addConfig('user.email', config.git.email)
  },
  cloneAnonym: async () => {
    await git.clone(appRepo) // 
  }, 
  commit: async (commitComment='anonym autocommit at shutdown') => {

    // auth? how to getConfig ? dont see nuthin in the API 
    if (!await git.checkIsRepo()) {
      log('error', `would have run newLocal` )
      //await repo.newLocal()
    } 
    await git.add('./*')
    await git.commit(commitComment)
  },
  git,  
  newLocal: async () => {
    if (!await git.checkIsRepo()) {
      await git.addConfig('user.name', config.git.user)
      await git.addConfig('user.email', config.git.email)
      await git.init(process.cwd())
      await git.addRemote('origin', repository.url)
      ///////await git.fetch() // fetch will overwrite local
    }              
  },
  push: async (origin=config.git.origin) => {
    if (config.git.origin) {
      await git.addRemote('origin', config.git.origin)
      await git.push('origin', 'master')
    }  
  },

}
