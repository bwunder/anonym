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
    try{
      if (!await git.checkIsRepo()) throw(new Error(`Local git repository not found in '${process.cwd()}'`))
      const changes = await git.status()  
      for (const key of Object.keys(changes)) {
        if (Array.isArray(changes[key]) && changes[key].length>0) {
          changes.ready = true
          break
        }
      } 
      if (!changes.ready) resolve()
      log('log', changes)
      if (await confirm(`Stage changes into ${name()} git repository now?`)===true) {
        await git.add('.')
        if (await confirm(`Commit staged changes now?`)===true) {
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
  git, 
  listConfig: async () => {
    log('log', await git.listConfig())
  },  
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
