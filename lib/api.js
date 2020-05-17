////NPM
const chalk = require('chalk')
const { edit } = require('external-editor')
const { prompt } = require('inquirer')
////core
const { exec, spawn, spawnSync } = require('child_process')
// !! TODO - fs promises 
const { mkdir, readdir, readFile, writeFile} = require('fs')
const path = require('path') // unqualified resolve can conflict
const util = require('util') // unqualified inspect can conflict
////local
const { chooseInstanceId, 
        intern, 
        isHost, 
        latestImageId, 
        listInstanceIds, 
        setDockerRemoteAPI, 
        sql, 
        startInstance} = require('../lib/catalog')
const { format, log } = require('../lib/log')
const { templates, scripts } = require('../lib/store')
const { query } = require('../lib/sqldb')
const { setDockerAPI, setDockerShell, setDockerDaemon} = require('../lib/tls')
const { ucons } = require('../lib/viewer')

const config = require('../config/config.json')

module.exports = api = {
  addFolder: async dir => {
    return new Promise(async (resolve, reject) => {
      mkdir(path.resolve(dir), err => {
        if (err) {
          if (err.code!=='EEXIST') {
            reject(err)
          }  
        } 
        resolve()
      })
    })
  },
  archiveQueries: async textFile => {
    // push contents of query cache to a file, replace existing file content
    return new Promise(async (resolve, reject) => {
      let collection = await templates.extract()
      let obj = "module.exports = {\n"
      for (let qry of collection) {
        obj += `${qry.name}: \u0060${qry.text}\u0060,\n` 
      }
      obj += '}'
      writeFile(textFile, obj, 'utf8', err => {
        if (err) {
          log('error', `(archiveQueries) writeFile error ${textFile}`)
          reject(err)
        }
        return resolve()
      })
    })
  },
  attachDocker: async () => {
    return new Promise( async (resolve, reject) => {
      try {
        const daemonStage = path.resolve(config.docker.bindings.private.hostPath, `daemon.json`)
        const daemonCfg = path.resolve(config.docker.daemon.cfgPath)
        let daemonOptions, currentOptions
        const awake = await isHost()
        const running = awake? listInstanceIds('up'): [] 
// TODO !!! try fetch configs from store                 
        for (let key of Object.keys(config.docker.bindings)) {
          if (config.docker.bindings[key].hostPath) {
            await api.addFolder(path.resolve(config.docker.bindings[key].hostPath))
          }
        }        
        let address = config.docker.daemon.socketPath
        if (running.length>0) {
            address = networkInterfaces()[config.docker.networkInterface].address
        } 
        api.apiOptions = await setDockerAPI(address) 
        api.cliOptions = await setDockerShell(address)  
        daemonOptions = await setDockerDaemon(address)
        try {
          currentOptions = await api.fileToJSON(daemonCfg)
        }
        catch (err) {
          if (err.code!=='ENOENT') reject(err)
        }
        if (daemonOptions) {
          api.jsonToFile(daemonOptions, daemonStage)
          daemonOptions = await api.fileToJSON(daemonStage) 
        }
        if (!daemonOptions && currentOptions) await api.shell(`sudo rm ${daemonCfg}`)
        if ((daemonOptions && !currentOptions) || daemonOptions!==currentOptions) {
          await api.shell(`sudo cp ${daemonStage} ${daemonCfg}`)
          if (awake && (await api.confirm(`Docker config has changed. Restart daemon now?`))) {
            await api.setEngine('restart')
          }  
        } 
        if (!awake && (await api.confirm('Docker daemon not active. Start now?'))) {
          await api.setEngine('start')
        }  
        setDockerRemoteAPI()      
        for (containerId of running) {
          await startInstance(containerId)
        }
        if (!sql.Images || !sql.Images.has(await latestImageId())) {
          await intern()
        }  
        resolve(true)
      }
      catch(err) {
        log('error', `(attachDocker) ${format(err)}`)
        resolve(false)
      }  
    })
  },
  batch: [''],
  choose: (choiceArray, message='Select one', suggestedResponse) => {
    // array already filtered but may not be propely sorted if mixed case 
    return new Promise( async (resolve, reject) => {
      if (!choiceArray || choiceArray.length===0) resolve()
      prompt([{
        type: 'list',
        name: 'choice',
        message: message + ' ',
        choices: choiceArray.sort((a, b) => a.localeCompare(b, 'en', {sensitivity: 'base'})).concat(' '),
        default: suggestedResponse 
      }])
      .then( answer => answer.choice)
      .catch( err => log('error', `(choose) ${err}`))  
    })
  }, 
  compile: metadata => {
    let str = ''
    if (!metadata) { // no passed arg use, cache
      str = api.batch.join('\n')
    } else if (!Array.isArray(metadata)) { // from object arg
      Object.keys(metadata).forEach( key => {
        if (!['i', 'q', 'Q'].includes(key)) {
          str += key.length===1? ` -${key}`: ` --${key}`
          if (key!==metadata[key]) {
            str += ` '${metadata[key]}'`
          }
        }
      })
    } else { // from string or string array arg
      str = metadata.join('\n').replace(/`/g, '\'')
    }
    return str // one string
  },
  confirm: async message => {
    return await prompt([{
      type: 'confirm',
      name: 'confirm',
      message: message + ' ',
      default: true
    }])
    .then( answer => answer.confirm)
    .catch( err => resolve(log('error', `(confirm) ${err}`)))  
  },  
  editFile: async textFile => {
    // works with emacs, kwrite and vim but atom-beta won't accept the temp file from xedit
    return new Promise( async (resolve, reject) => {
      try {
        let text = await api.fileToJSON(textFile)
        let newtext = await api.editText(text)
        if (text!==newtext) {
          writeFile(textFile, newtext, 'utf8', err => {
            if (err) {
              log('error', `(archiveQueries) writeFile error ${textFile}`)
              reject(err)
            }
          })
        } 
        resolve()
      }
      catch(err) {
        reject(err)
      }
    })
  },
  editText: async text => {
    return new Promise( (resolve, reject) => {
      try {
        process.env.EDITOR=config.editor||'vi'
        if (!config.editor) {
          log('warn', `config.editor not defined, using process.env.EDITOR: ${process.env.EDITOR}`)
        }
        text = edit(text)
        return resolve(text)
      }
      catch(err) {
        reject(err)
      }
    })
  },
  fileToBatch: async (scriptFile, filter) => {
    return new Promise( (resolve, reject) => {
      try {
        readFile(scriptFile, 'utf8', (err, script) => {
          if (err) reject(err)
          if (script) {
            api.batch.splice(0)
            api.batch.push(`-- ${scriptFile}`)
            for (let line of script.split('\n')) {
              api.batch.push(line)
            }
            return resolve()
          } else {
            return resolve()
          }  
        })
      }
      catch(err) {
        reject(err)
      }
    })
  },
  fileToJSON: async (fromFile) => {
    return new Promise( (resolve, reject) => {
      try {
        readFile(path.resolve(fromFile), 'utf8', (err, buffer) => {
          if (err) reject(err)
          resolve(buffer)          
        })
      }
      catch(err) {
        reject(err)
      }
    })
  },
  getPool: (instanceId=sql.Instance) => {
    // from map of pools known to app
    sql.Pools.get(instanceId)
  },
  getTimestamp: () => { 
    // a valid string with no white space for file names
    return new Date().toISOString().replace(':','_')
  },
  htmlToFile: async (txt, toFile) => {
    return new Promise( async (resolve, reject) => {
      try {
        writeFile(path.resolve(toFile), txt, {}, (er) => er? reject(er): resolve())
      }
      catch(err) {
        reject(err)
      }
    })
  },
  input: async (message='Enter a Response', suggestedResponse) => {
    return new Promise( async (resolve, reject) => {
      prompt([{
        type: 'input', 
        name: 'input',
        message: message + ' ',
        default: suggestedResponse
      }])
      .then(async answer => resolve(answer.input))
      .catch( err => resolve(log('error',`(input) promise\n${err.stack}`))) 
    })  
  }, 
  interactiveShell: (containerId, command) => {
    return new Promise( async (resolve, reject) => {
      try {
        log('warn', `${view.name()} Event loop is blocked while bash shell is open.`)
        containerId = await chooseInstanceId('up', 'SQL Container', sql.Instance)
        let spawnArgs = api.cliOptions.concat([`exec`, `--interactive`, `--tty`, `${containerId}`, config.cli.bash.path])
        if (command) spawnArgs.push(command)
        if (containerId) {
          log('log', chalk`Connecting (perhaps as 'root'!) to SQL Server container ${containerId}
            {bold bcp} & {bold sqlcmd} are available in the current $PATH. Also, from this prompt, 
            environment variables can be used with either tool to connect as 'sa':
              {bold sqlcmd -U sa -P $MSSQL_SA_PASSWORD -Q'select @@SERVERNAME'}
            Type {bold exit} to close shell in container and resume the now blocked node.js event loop.`)
          return resolve(spawnSync(`docker`, spawnArgs, {stdio: [0, 1, 2]}))
        }
      }
      catch(err) {
        reject(err)
      }
    })
  },
  jsonToFile: async (buffer, toFile) => {
    return new Promise( async (resolve, reject) => {
      try {
        writeFile(path.resolve(toFile), util.inspect(buffer), 'utf8', (er) => er? reject(er): resolve())
      }
      catch(err) {
        reject(err)
      }
    })
  },
  listDatabases: async (containerId=sql.Instance) => {
    let databases = []
    let results = await query('select name from sysdatabases', containerId)
    for (let db of results.recordset) {
      databases.push(db.name)
    }
    return databases
  },
  listFiles: async (folder, filter) => {
    return new Promise( async (resolve, reject) => {
      try {
        let list=[]
        readdir(path.resolve(folder),'utf8', (files) => {
          files.forEach( fileName => {
            if (fileName.includes(filter)) {
              list.push(fileName)
            }
          })
          return resolve(list.sort())
        }) 
      }
      catch(err) {
        reject(err)
      }
    })
  },
  mssqlConf: (containerId, confArgs) => {
    // launch the .py file, mssql-conf not compiled in RTM image and no make,  
    new Promise( async (resolve, reject) => {
      if (sql.ContainerInfos.has(containerId)) {
        let options = {
          Cmd: [config.cli.bash.path, '-c', `${config.mssql.conf} ${confArgs}`],
          AttachStdout: true,
          AttachStderr: true
        }
        let container= await docker.getContainer(containerId)
        container.exec(options, (err, exe) => {
          if (err) reject(err)
          exe.start( (err, stream) => {
            if (err) reject(err)
            container.modem.demuxStream(stream, process.stdout, process.stderr)
            return resolve(exe.inspect( (err, data) => {
              if (err) reject(err)
              return data
            }))
          })
        })
      }
    })
  },
  mssqlFiles: (containerId=sql.Instance, folder, filter) => {
    return new Promise( async (resolve, reject) => {
      try{
        log('log', chalk.dim(`\tcontainerId: ${containerId} \n\tfolder: ${folder} \n\tfilter: ${filter}`) )
        // if (!containerId) containerId = sql.Instance
        let options = {
          Cmd: [config.cli.bash.path, '-c', `ls -lb ${folder} | grep ${filter}`],
          AttachStdout: true,
          AttachStderr: true
        }
        let container = await docker.getContainer(containerId)
        if ((await container.inspect()).State.Status!=='running') {
          container.exec(options, (err, exe) => {
            if (err) reject(err)
            exe.start( (err, stream) => {
              if (err) reject(err)
              container.modem.demuxStream(stream, process.stdout, process.stderr)
              return resolve(exe.inspect( (err, data) => {
                if (err) reject(err)
                return data
              }))
            })
          })
        }
      }
      catch (err){
        reject(err)
      }
    })
  },
  restoreScript: async scriptName => {
    return new Promise( async (resolve, reject) => {
      writeFile(scriptName, await scripts.get(scriptName), err => {
        if (err) reject(err)
        return resolve()
      })
    })  
  },
  secret: async (message='Enter Secret', suggested) => {
    return new Promise( async (resolve, reject) => {
      prompt([{
        type: 'password', 
        name: 'input',
        message: message + ' ',
        default: suggested
      }])
      .then(async answer => resolve(answer.input))
      .catch( err => resolve(log('error',`(secret)\n${err.stack}`))) 
    })  
  }, 
  setEngine: (action='status', option='target') => {
    return new Promise( async (resolve, reject) => {
      try {
        return api.shell(`sudo getent group docker`)
          .then( async group => {
            if (!group) throw(new Error('(setEngine) docker group not found'))
            if (!group.includes(process.env.USER)) {
              log('info', await api.shell(`sudo usermod -aG docker ${process.env.USER}`))
            }
            if (action==='status') resolve(await api.shell(`ps -e|grep dockerd`)) 
            else {
              await api.shell(`sudo service docker ${action}`) // two password prompts if no sudo
              log('log', `(setEngine) ${action} dockerd ${ucons.get('confirm')}`)
              if (action.includes('start')) {
                switch (option) {
                  case ('all'):
                    for (const instanceId of listInstanceIds('all')) {
                      log('confirm', `(setEngine) start instance: ${instanceId}`)
                      await startInstance(instanceId)
                    }
                    break
                  case ('none'):
                    break
                  case ('running'):
                    for (const instanceId of listInstances('up')) {
                      log('confirm', `(setEngine) start instance: ${instanceId}`)
                      await startInstance(instanceId)
                    }
                    break
                  case ('target'):
                  default:
                    if (action.includes('start') && sql.ContainerInfos.get(sql.Instance).State==='running') {
                      log('confirm', `(setEngine) start target: ${sql.Instance}`)
                      await startInstance(sql.Instance)
                    } 
                    break
                }  
              }  
              resolve() 
            }  
          })  
          .catch( err => {
            log('error', `(setEngine) failed\n${err.message}\n`)
            reject(err)
          })
      }
      catch(err) {
        reject(err)
      }
    })
  },
  shell: async bashCommand => { 
    return new Promise( async (resolve, reject) => {
      try {
        if (bashCommand.startsWith(`sudo`)) {
          if (config.cli.canElevate) log('sudo', bashCommand)
          else resolve(log('error', `(shell) ${bashCommand}`))
        }
        exec(bashCommand, (er, stdout, messages) => {
          if (er) {
            if (er.code===1) {
              resolve()  
            } else {
              reject(new Error(`(shell) child process exception:\n${er}`))
            }
          }  
          if (messages) log('info', `(shell) stderr messages from child process\n${messages}`)
          resolve(stdout.trim())
        })
      }
      catch(err) {
        reject(err)
      }  
    })
  },  
  spawnTask: async (bashCommand) => { 
    return new Promise( async (resolve, reject) => {
      try {
        args = bashCommand.split(' ')
        cmd = args.shift()
        if (config.cli.canElevate && cmd.startsWith(`sudo`)) log('sudo', bashCommand)
        submit = spawn(cmd, args, {"detatched": true, "stdio": 'ignore' })
        submit.unref()
        resolve(log('confirm', chalk`(spawnTask) Submitted bash command:\n\t{green ${bashCommand}}`))
      }
      catch(er) {
        reject(er)
      }  
    })
  },
  writeResults: async (outfile, data) => {
    return new Promise( (resolve, reject) => {
      try {
        writeFile(path.resolve(outfile), JSON.stringify(data, null, 2), err => {
          if (err) reject(err)
          resolve()
        })
      }
      catch(err) {
        reject(err)
      }
    })
  }
  
}
