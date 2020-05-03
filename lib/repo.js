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
    return new Promise( async (resolve, reject) => {
      return git.checkIsRepo()
      .then( (isRepo) => {
        if (!isRepo) {
          resolve(log('error', `${name()} git repository not found.` ))
        } 
        return git.status()  
      })
      .then( (changes) => {
        for (const key of Object.keys(changes)) {
          if (Array.isArray(changes[key]) && changes[key].length>0) {
            changes.toStage = true
            break
          }
        } 
        if (!changes.toStage) resolve()
        else {
          log('log', changes)
          return confirm(`Stage changes into ${name()} git repository now?`)
        }
      })
      .then( (stageChanges) => {
        if (!stageChanges) resolve()
        return git.add('.')
      })  
      .then( () => {  
        return confirm(`Commit staged changes now?`)
      })
      .then( (commitChanges) => {
        if (!commitChanges) resolve()
        return input('Commit comment', `CLI source file changes detected`)
      })
      .then( (comment) => {
        resolve(git.commit(comment))
      })
      .catch( err => {
        resolve(log('error', `(commitChanges) error\n${format(err)}`))
      })  
    })  
  },
  git, 
  listConfig: async () => {
    await git.listConfig()
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
