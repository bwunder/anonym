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
  commit: async () => {
    try{
      if (!await git.checkIsRepo()) throw(new Error(`Local git repository not found in '${process.cwd()}'`))
      var changes = await git.status()  
log('confirm', `first test: changes.staged ${changes.staged}`)
      for (const key of Object.keys(changes)) {
        if (Array.isArray(changes[key]) && changes[key].length>0) {
          changes.ready = true
          break
        }
      } 
      if (!changes.ready) resolve()
      log('log', changes)
      const stage = await confirm(`Stage changes into ${name()} git repository now?`)
log('confirm', `stage ${stage}`)
      if (stage) {
        await git.add('.')
        changes = await git.status()
      } 
log('confirm', `last test: changes.staged ${changes.staged}`)
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
      log('error', `(commitChanges) error\n${format(err)}`)
      resolve()
    }  
  },
  fetch: async () => {
    log('warn', `(fetch) Not implemented. Use the installed git tools.`)
  },   
  git, 
  init: async () => {
    log('warn', `(init) Not implemented. Use the installed git tools.`)
  },   
  merge: async () => {
    log('warn', `(merge) Not implemented. Use the installed git tools.`)
  },   
  push: async () => {
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
  remote: async () => {
    return words.getLast('remote')
    .then( async (phrase) => {
      if (!phrase) {
        phrase = await api.input(`Passphrase for '${config.git.origin}'`)
        words.put(phrase)
      }         
      return `https://${config.git.user}:${phrase}@${config.git.origin}`
    })
  }  

}
