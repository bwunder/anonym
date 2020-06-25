//// NPM
const simpleGit = require('simple-git/promise')
//// CORE
//// LOCAL
const { confirm, input, secret } = require('../lib/api')
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
      const changes = await git.status()  
      if (changes.ahead>0) log('warn', `Local git repository has ${changes.ahead} commits ready to push to remote`) 
      for (const key of Object.keys(changes)) {
        if (Array.isArray(changes[key]) && changes[key].length>0) {
          log('log', changes)
          const stage = await confirm(`Stage changes into local git repository?`)
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
      const changes = await git.status()  
      if (changes.staged.length>0) {
        const doit = await confirm(`Commit staged changes?`) 
        if (doit) {
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
  //   GitError: fatal: unable to access 'https://bwunder:good14Me@https://github.com/bwunder/anonym.git/': Could not resolve host: https

  //   at GitExecutor.<anonymous> (/home/bill/anonym/node_modules/simple-git/src/lib/git-executor.js:35:23)
  //   at Generator.throw (<anonymous>)
  //   at rejected (/home/bill/anonym/node_modules/simple-git/src/lib/git-executor.js:6:65)
  //   at processTicksAndRejections (internal/process/task_queues.js:97:5) {
  // task: {
  //   concatStdErr: false,
  //   onError: undefined,
  //   format: 'utf-8',
  //   commands: [
  //     'push',
  //     'https://bwunder:good14Me@https://github.com/bwunder/anonym.git',
  //     'master'
  //   ],
  //   parser: [Function: parser]
  // }

    try {      
      // const remote = `https://${config.git.origin}` //await repo.remoteURL() 
      const changes = await repo.status()
      if (changes.ahead>0) {
        const push = await confirm(`Push changes to remote now?`) 
        if (push) {
          if (await git.listRemote()) {
            await git.push(config.git.origin, 'master')
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
    // return words.getLast('remote')
    // .then( async (phrase) => {
      // if (!phrase) {
      //   phrase = await secret(`${config.git.user}'s passphrase for '${config.git.origin}'`)
      //   words.upsert('remote', phrase)
      // }         
      return `https://{config.git.origin}`
    // })
    // .catch( err => {
    //   log('error', `(remoteURL) failed to manifest\n${err}`)
    // })
  },
  rebase: async () => {
    await git.rebase()
  },
  reset: async () => { 
    // unstage everything now staged 
    await git.reset()
  },
  status: git.status

}
