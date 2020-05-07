//// NPM
const simpleGit = require('simple-git/promise')
//// CORE
//// LOCAL
const { confirm, input } = require('../lib/api')
const { format, log } = require('../lib/log')
const { words } = require(`../lib/store`)
const { name } = require('../lib/viewer')

const config = require('../config/config.json')

const git = simpleGit(process.cwd())

module.exports = repo = {
  // stage and commit any changes in folder hierarchy into local repo
  add: async () => {
    try{
      if (!await git.checkIsRepo()) throw(new Error(`Local git repository not found in '${process.cwd()}'`))
      var changes = await git.status()  
      for (const key of Object.keys(changes)) {
        if (Array.isArray(changes[key]) && changes[key].length>0) {
          log('log', changes)
          const stage = await confirm(`Stage changes into ${name()} git repository now?`)
          if (stage) {
            await git.add('.')
          } 
          break
        }
      } 
    }    
    catch(err) { 
      log('error', `(add) error\n${format(err)}`)
    }  
  },
  commit: async () => {
    try{
      if (!await git.checkIsRepo()) throw(new Error(`Local git repository not found in '${process.cwd()}'`))
      var changes = await git.status()  
      if (changes.staged.length>0) {
        const commit = await confirm(`Commit staged changes now?`) 
        log('confirm', `commit ${commit}`)
        if (commit) {
          const comment = await input('Commit comment', `CLI source file changes detected`)
          await git.commit(comment)
        }
      }
    }    
    catch(err) { 
      log('error', `(commit) error\n${format(err)}`)
    }  
  },
  fetch: async () => {
    try {
      // fetch items from remote that are different or missing in local repo
      if (!config.git.origin) throw(new Error(`Remote git repository not found`))
      if (await git.checkIsRepo()) throw(new Error(`Local git repository not found`))
      await git.fetch()
    }
    catch(err) {
      log('error', `(fetch) error \n${format(err)}`)
    }
  },   
  init: async () => {
    // initialize a local repo, in anonym root folder
    // will use .gitignore included in anonym project  
    if (!await git.checkIsRepo()) {
      await git.init()
    }  
  },   
  merge: async () => { 
    // merge local and remote
    if (!await git.checkIsRepo()) throw(new Error(`Local git repository not found in '${process.cwd()}'`))
    log('warn', `(merge) Not implemented. Use the installed git tools.`)
  },   
  push: async () => {
    // push local repo to remote
    try {      
      const remote = repo.remote() 
      if (remote && (await git.status()).ahead>0) {
        const push = await confirm(`Push changes to remote now?`) 
        if (push) {
          if (await git.listRemote()) {
            await git.push(repo.remote(), 'master')
          }  
          log('log', `tracked changes pushed`)
        }  
      }  
    }
    catch(err) {
      log('error', `(push) error \n${format(err)}`)
    }
  },
  remoteURL: async () => { 
    // returns the remote url 
    return words.getLast('remote')
    .then( async (phrase) => {
      if (!phrase) {
        phrase = await api.input(`Passphrase for '${config.git.origin}'`)
        words.put(phrase)
      }         
      return `https://${config.git.user}:${phrase}@${config.git.origin}`
    })
  },
  reset: async () => { 
    // unstage everything now staged 
    await git.reset
  },
  status: git.status

}
