//// NPM
const simpleGit = require('simple-git/promise')
//// CORE
const path = require('path')
//// LOCAL
const { format, log } = require('../lib/log')
const { words } = require('../lib/store')

const { appRepo } = require('../package.json')
const config = require('../config/config.json')

const git = simpleGit()
const remote = `https://${config.git.user}:${Promise.resolve(words.getLast('remote'))}@${config.git.origin}`;

module.exports = repo = {
  author: async () => {
    await git.addConfig('user.name', config.git.user)
    await git.addConfig('user.email', config.git.email)
  },
  commit: async (commitComment) => {
    
    // auth? how to getConfig ? dont see nuthin in the API 
    if (!await git.checkIsRepo()) {
      await repo.newLocal()
    } 
    await git.add('./*')
    await git.commit(commitComment)
    if (config.git.origin) {
      await git.addRemote('origin', config.git.origin)
      await git.push('origin', 'master')
    }
  },  
  newLocal: async () => {
    if (!await git.checkIsRepo()) {
      await git.init() // use current dir
      await git.addRemote('origin', repository.url)
      ///////await git.fetch() // fetch will overwrite local
    }              
  },
  cloneAnonym: async () => {
    await git.clone(appRepo) // 
  } 
}
