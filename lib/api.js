////NPM
const Docker = require('dockerode')
const chalk = require('chalk')
const xedit = require('external-editor')
const getPort = require('get-port')
const pem = require('pem')
const prettyData = require('pretty-data')
////core
const stream = require('stream')
const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
////local
const config = require('../config/config')
const {name, version} = require('../package')

const docker = new Docker()

let sqlpad

module.exports = exports = api = {

  addFile: async (textFile) => {

    return new Promise(async function(resolve, reject) {
      let text = await api.editText('')
      fs.writeFile(textFile, text, (err) => {
        if (err) {
          api.log('error', `(editFile) writeFile error ${textFile}`)
          reject(err)
        }
        resolve()
      })
    })

  },
  bandAid: chalk`\n\t\t${name}   {green l Q _ \n\t\t\t   |   \n\t\t\t  / \\}   ${version}\n`,
  batch: [''],
  checkNPM: async () => {

    return new Promise(function(resolve, reject) {
      childProcess.exec(`npm outdated`, {}, (err, result) => {
        if (err) resolve(err.message)
        store.npm.put(result)
        resolve(result|| 'up to date')
      })
    })

  },
  commandAid: (cmds) => {

    let admin=[], builtin=[], cli=[], cat=[], etl=[], inject=[], terminate=[]
    cmds.forEach( (cmd) => {
      switch(true) {
        case(['ERRORLOG', 'FILES', 'SQLPAD'].includes(cmd._name.toUpperCase())):
          admin.push(`${chalk.cyan(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['HELP', 'EXIT', 'LOGLEVEL'].includes(cmd._name.toUpperCase())):
          builtin.push(`${chalk.italic(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['QUERY', 'SCRIPT'].includes(cmd._name.toUpperCase())):
          inject.push(`${chalk.magenta(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['GO', 'RUN', 'SQLCMD', 'ISSQL'].includes(cmd._name.toUpperCase())):
          terminate.push(`${chalk.green(cmd._name).padEnd(20)}${cmd._description}`)
          break
        // case(['BCP', 'BULK'].includes(cmd._name.toUpperCase())):
        //   etl.push(`${chalk.yellow(cmd._name).padEnd(20)}${cmd._description}`)
        //   break
        case(['CONFIG', 'ENGINE', 'IMAGE', `INSTANCE`].includes(cmd._name.toUpperCase())):
          cat.push(`${chalk.blue(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['ABOUT', 'BATCH', `CATALOG`, `HISTORY`, 'POOL', 'USE'].includes(cmd._name.toUpperCase())):
          cli.push(`${chalk.red(cmd._name).padEnd(20)}${cmd._description}`)
          break
        default:
          break
      }
    })
    // ${chalk.underline(`ETL`).padEnd(20).padStart(12)} {gray ETL and Data Staging commands}
    // \t${etl.join('\n\t').padStart(5)}
    return [
      chalk`\tEntered text is processed as a {bold.italic ${name}} CLI command else accumulated into the Batch - an array of text lines.
      \tAdditional non-command text typed - or lines pasted - at the prompt are accumulated as entered into the Batch.
      \tWhen a {italic.green terminating command} on a new line is followed by ENTER, the Batch is sent to the Target SQL Server.
      \tCommands may be entered at any time and are not implicitly destructive to the Batch other than upon
      \tsuccessful query exection when the Batch is logged and reset and when the user request a reset.\n
      ${chalk.underline(`CLI`).padEnd(20).padStart(12)} {gray ClI scoped query instrumentation commands}
      \t${cli.join('\n\t').padStart(5)}
      ${chalk.underline(`Inject`).padEnd(20).padStart(12)} {gray Commands that Overwrite the Batch with app stored t-SQL scripts}
      \t${inject.join('\n\t').padStart(5)}
      ${chalk.underline(`Terminate`).padEnd(20).padStart(12)} {gray Commands to Compile Batch as T-SQL & submit to Target}
      \t${terminate.join('\n\t').padStart(5)}
      ${chalk.underline(`Docker`).padEnd(20).padStart(12)} {gray Container Scoped Management Commands}
      \t${cat.join('\n\t').padStart(5)}
      ${chalk.underline(`Target`).padEnd(20).padStart(12)} {gray Target SQL Server Administration Commands}
      \t${admin.join('\n\t').padStart(5)}
      ${chalk.underline(`Vorpal`).padEnd(20).padStart(12)} {gray Vorpal Built-ins}
      \t${builtin.join('\n\t').padStart(5)}
      \n\t{gray Type}  {italic.bold --help} {gray for this Application Usage Info or} {italic.bold help} {gray for CLI command listing}
      \t{gray Use} {bold.italic help <command>} {gray or} {italic.bold <command> --help} {gray any CLI command\'s Usage details}
      \t{gray Command args are represented as [optional] or <required>, and documented as either the word if a literal
      \tor hyphenated-if-user-input}
      \n\tUPPERCASE 'GO' and UPPERCASE 'USE' are treated as valid inline tSQL. Only the lowercase is processed as a CLI command
      \n\tTry Copy-paste of Docker _ids from {italic.bold catalog --list} output when needed in a CLI command arg` ]

  },
  compile: (metadata) => {

    let str
    if (!metadata) {
      str= api.batch.join('\n')
    } else if (!Array.isArray(metadata)) {
      Object.keys(metadata).forEach((key) => {
        if (!['i', 'q', 'Q'].includes(key)) {
          str+= key.length===1? ` -${key}`: ` --${key}`
          if (key!=metadata[key]) {
            str+= ` \'${metadata[key]}\'`
          }
        }
      })
    } else {
      str = metadata.join('\n').replace(/`/g, "'") // for sqlcmd prefix array
    }
    return str

  },
  dockerAid: () => {
    return chalk`
      {italic.bold ${'image    --pull'.padEnd(40)}} get '${config.docker.pull.repo}:latest' from dockerhub
      {italic.bold ${'image    --run    [image-id]'.padEnd(40)}} Create and start a new SQL Server container from an image
      {italic.bold ${'instance --target [container-id]'.padEnd(40)}} Target your queries at a SQL Server Container
      {italic.bold ${'catalog'.padEnd(40)}} Catalog of Local SQL Server Images, Containers and Connection Pools
      {italic.bold ${'instance --start  [container-id]'.padEnd(40)}} Start a SQL Server Container
      ${(config.sqlpad.sqlpad)?`or go to {italic.underline https://127.0.0.1:${config.sqlpad['https-port']}} in a browser using V8`:''}
      {italic.bold --help} for Application Usage or {italic.bold help} for CLI command list
      {italic.bold help <CLI-command>} or {italic.bold <CLI-command> --help} for that CLI command\'s Usage Info`

  },
  developFile: async (textFile) => {

    api.log('log', `opening '${textFile}' in '${config.cli.ide}'`)
    if (!textFile.endsWith('sql')) {
      api.log('log', `Saved changes may not be recognized until ${name} is restarted`)
    }
    childProcess.spawn(config.cli.ide, [path.resolve(textFile)])

  },
  editFile: async (textFile) => {

    // works with emacs, kwrite and vim but atom-beta can't seem to find the temp file xedit uses
    return new Promise(function(resolve, reject) {
      let newtext
      fs.readFile(textFile, 'utf8', async (err, text) => {
        if (err) {
          api.log('error', `(editFile) readFile error ${textFile}`)
          api.log('error', err)
        } else {
          newtext = await api.editText(text)
          if (text!=newtext) {
            fs.writeFile(textFile, newtext, (err) => {
              if (err) {
                api.log('error', `(editFile) writeFile error ${textFile}`)
                api.log('error', err)
              }
              resolve()
            })
          } else {
            resolve()
          }
        }
      })
    })

  },
  editText: async (text) => {

    // config editor with any user configured text editor in user's $PATH that accepts text.
    // in addition to vim; have also used kwrite on openSUSE, GNU Emacs & Atom-beta from github
    // vim or Emacs best for editing batch, Atom better for source files, can never remember how to use vim
    // SQLOps alpha does not accept text (or file) arg at the command-line, VS code accepts file but not text
    return new Promise(function(resolve, reject) {
      if (!config.cli.editor) {
        api.log('warn', `config.cli.editor not defined`)
      }
      let save=process.env.EDITOR
      process.env.EDITOR=config.cli.editor
      text = xedit.edit(text)
      return resolve(text)
    })

  },
  elevate: async (bashCommand) => {

    return new Promise(function(resolve, reject) {
      try {
        resolve(childProcess.spawnSync(`sudo`, bashCommand.split(' '), {
          stdio: [0, 1, 2]
        }, (err) => {
          if (err) reject(err)
        }))
      }
      catch(err) {
        reject(err)
      }
    })

  },
  fileToBatch: async (scriptFile) => {

    return new Promise(function(resolve, reject) {
      fs.readFile(scriptFile, 'utf8', (err, script) => {
        switch (true) {
          case (err):
            api.log('warn', `${(err.code)? err.code: ''} ${err.message}`)
            break
          case (!script):
            api.log('warn', `failed to fetch script from file ${scriptFile}`)
            break
          default:
            api.batch.splice(0)
            api.batch.push(`-- ${scriptFile}`)
            for (line of script.split('\n')) {
              api.batch.push(line)
            }
            break
        }
        return resolve()
      })
    })

  },
  fileToJSON: async (fromFile) => {

    return new Promise(function(resolve, reject) {
      fs.readFile(path.resolve(fromFile), 'utf8', (err, data) => {
        if (err) reject(err)
        resolve(data)
      })
    })

  },
  format: (gi) => {

    // implicit outer level, prolly not good for recursive use
    let go=''
    switch (typeof gi) {
      case ('undefined'):
        go = 'undefined'.grey
        break
      case ('boolean'):
        go = !gi? gi.red: gi.green
        break
      case ('number'):
        go = gi.blue
        break
      case ('string'):
        try {
          if (JSON.parse(gi)) {
            go = prettyData.pd.json(gi)
          }
        }
        catch(e) {
          go = gi
        }
        break
      case ('object'):
        switch (true) {
          case (Buffer.isBuffer(gi)):
            go = prettyData.pd.json(gi.toString())
            break
          case (Array.isArray(gi)):
            gi.forEach(function(result) {
              if (typeof result==='object') {
                go+= prettyData.pd.json(result)
              } else {
                go+=result
              }
            })
            break
          default:
            if (gi && gi.recordset && gi.recordsets) {
              gi.recordsets.forEach(function(rs) {
                go += prettyData.pd.json(rs)
              })
            } else {
              go = prettyData.pd.json(gi)
            }
            break
        }
        break
      default:
        go = `unexpected type ${typeof gi}`.inverse
        break
    }
    return go + '\n'

  },
  genCA: () => {

    return new Promise( async function(resolve, reject) {
      let caKey = path.resolve(config.volume.private.path,`CA-key.pem`)
      let caCert = path.resolve(config.volume.private.path,'CA-cert.pem')
      try {
        await api.elevate(`ls -dH ${config.volume.private.path}`)
      } catch (err) {
        if (err.code === 'ENOENT') {
          api.log('log', `creating link from ${path.resolve(config.volume.private.path)} to ${config.volume.private.link}`)
          await api.elevate(`ln -s ${config.volume.private.link} ${path.resolve(config.volume.private.path)}`)
        } else {
          api.log('error', err)
        }
      }
      finally {
        await api.elevate(`openssl genrsa -aes256 -out ${caKey} 2048`)
        fs.accessSync(caKey, fs.constants.F_OK)
        await api.elevate(`openssl req -new -key ${caKey} -x509 -days 1000 -out ${caCert}`)
        resolve()
      }
    })

  },
  genCertificate: (name) => {

    return new Promise(async function(resolve, reject) {
      try {
        let caKey = path.resolve(config.volume.private.path,`CA-key.pem`)
        let caCert = path.resolve(config.volume.private.path, 'CA-cert.pem')
        let key = path.resolve(config.volume.private.path, `${name}-key.pem`)
        let signingReq = path.resolve(config.volume.private.path, `${name}-signingReq.csr`)
        let cert = path.resolve(config.volume.private.path, `${name}-cert.pem`)
        let cnf =  path.resolve(config.volume.private.path, `openssl.cnf`)
        return api.elevate(`openssl genrsa -aes256 -out ${key} 2048`)
        .then( async () => {
          return api.elevate(`openssl req -new -config ${cnf} -key ${key} -out ${signingReq}`)
        })
        .then( async () => {
          resolve(api.elevate(`openssl x509 -req -days 365 -in ${signingReq} -CA ${caCert} -CAkey ${caKey} -CAcreateserial -out ${cert}`))
        })
        .catch((err) => {
          api.log('error', `(genCertificate) elevator error ${err.message}`)
          reject(err)
        })
      } catch (err) {
        api.log('error', `(genCertificate) error ${err.message}`)
        reject(err)
      }
    })

  },
  getAddress: () => {

    let addressMap=new Map()
    if (api.sqlCatalog.ContainerInfos.size>0) {
      for ([id, info] of api.sqlCatalog.ContainerInfos) {
        if (info.State==='running') {
          addressMap.set(id, {
            bridge: `${info.NetworkSettings.Networks.bridge.IPAddress}:${info.Ports[0].PrivatePort}`,
            localhost: `${info.NetworkSettings.Networks.bridge.Gateway}:${info.Ports[0].PublicPort}`
          })
        }
      }
    }
    return addressMap

  },
  getInstanceInfo: (containerId) => {

    containerId= containerId || api.sqlCatalog.Instance
    if (api.sqlCatalog.ContainerInfos.has(containerId)) {
      return api.sqlCatalog.ContainerInfos.get(containerId)
    }

  },
  getImage: async (imageId) => {

    return new Promise(function(resolve, reject) {
      if (!imageId) {
        if (api.sqlCatalog.Images.size===0) {
          api.log('warn', `no SQL Server images in catalog, use 'image --pull' to get latest`)
          api.pullImage()
        } else if (api.sqlCatalog.Images.size===1) {
          imageId=api.sqlCatalog.Images.keys().next()
        } else {
          if (api.sqlCatalog.Instance) {
            imageId=api.getInstanceInfo().ImageID
            if (!imageId) {
              api.latestImage()
              .then( (image) => {
                imageId=image.Id
              })
            } else if (api.sqlCatalog.Images.size===0) {
              api.log('warn', `no SQL Server images in catalog, try 'image --pull'`)
            }
            // need an id to get there from here
          }
        }
      }
      return resolve(api.sqlCatalog.Images.get(imageId))
    })

  },
  getProcesses: async (containerId) => {

    return new Promise(async function(resolve, reject) {
      try{
        containerId=containerId || api.sqlCatalog.Instance
        if (containerId && api.sqlCatalog.ContainerInfos.has(containerId)) {
          let top = {"Processes":[]}
          let container = docker.getContainer(containerId)
          if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
            top=container.top("-x") //no (other well, -x used to work) flags seem to work????
          }
          resolve(top)
        }
      }
      catch (err){
        api.log('warn', `(getProcesses) error container: ${containerId}`)
        reject(err)
      }
    })

  },
  getTimestamp: () => {

    return new Date().toISOString().replace(':','_')

  },
  interactiveShell: (containerId, command='') => {

    return new Promise(function(resolve, reject) {
      // one size fits all
      let spawnArgs = [`exec`, `--interactive`, `--tty`, `${containerId}`, `/bin/bash` ]
      if (command) spawnArgs.push(command)
      if (containerId) {
        childProcess.execSync(`docker exec -d ${containerId} /bin/bash
          docker exec -d ${containerId} ln -sf ${config.cli.odbc.path}/sqlcmd /usr/bin
          docker exec -d ${containerId} ln -sf ${config.cli.odbc.path}/bcp /usr/bin`)
//          docker exec -d ${containerId} ln -sf -T ${config.mssql.confPath} ${config.mssql.bin.path}/mssql-conf
        api.log('info', [`Entering interactive session \n\tSQL Server container ${containerId}...`,
          `\t'bcp, 'sqlcmd', 'mssql-conf' commands soft linked to current path...`,
          `Works to pass $MSSQL_SA_PASSWORD from container\'s environment works to 'bcp' or 'sqlcmd' -P switch`.yellow,
          `Review/modify current mssql-conf settings file using 'cat /var/opt/mssql/mssql.conf'`,
          `Type 'exit' to close interactive session and resume ${name} prompt at host`].join('\n'))
        api.log('debug', `(spawnSync) docker exec --interactive --tty ${containerId} /bin/bash`)
        return resolve(childProcess.spawnSync(`docker`, spawnArgs, {stdio: ['inherit', 'inherit', 'inherit']}))
      }
    })

  },
  intern: async (instanceId) => {

    if (await api.isDocker()) {
      instanceId = instanceId || await store.configs.getLastInstanceId()
      api.sqlCatalog.Images = new Map()
      api.sqlCatalog.ContainerInfos = new Map()
      api.sqlCatalog.Instance
      api.sqlCatalog.Pools = api.sqlCatalog.Pools || new Map()
      if (await api.internImages()) {
        if (await api.internContainers()) {
          if (!instanceId) {
            let id, info
            // if only one, use it
            if (api.sqlCatalog.ContainerInfos.size===1) {
              for ([id, info] of api.sqlCatalog.ContainerInfos) {
                instanceId=id
              }
            } else {
              // if is only one running, use it
              let running=[]
              for ([id, info] of api.sqlCatalog.ContainerInfos) {
                if (info.State==='running') {
                  running.push(id)
                }
              }
              if (running.length===1) {
                instanceId=running[0]
              }
            }
          }
        }
        if (api.sqlCatalog.ContainerInfos.has(instanceId)) {
          await api.internInstance(instanceId)
          if (instanceId===api.sqlCatalog.Instance) {
            if (api.sqlCatalog.ContainerInfos.get(instanceId).State==='running') {
              await sqldb.openPool(instanceId)
              // every unique config should get saved and maintained to history from first openPool
              store.configs.update(config)
            } else {
              api.log('warn', chalk`(intern) Target SQL Container is not 'running', try {italic.bold instance --start}`)
            }
          } else {
            api.log('warn', `(intern) No SQL Server has been Targeted`)
          }
          api.log('log', api.bandAid)
        }
      }
    }

  },
  internImages: async () => {

    let images= await docker.listImages()
    for (let image of images) {
      if (image.RepoDigests[0].startsWith(`${config.docker.pull.repo}@`)) {
        api.sqlCatalog.Images.set(image.Id, image)
      }
    }
    return true

  },
  internContainers: async () => {

    for (let [imageId, image] of api.sqlCatalog.Images ) {
      let containers = await docker.listContainers({
            "all": true,
            "size": true,
            "filters": { "ancestor": [`${imageId}`] }
          })
      for (info of containers)  {
        api.sqlCatalog.ContainerInfos.set(info.Id, info)
      }
    }

  },
  internInstance: (instanceId=api.sqlCatalog.Instance) => {

    api.sqlCatalog.Instance = instanceId

  },
  internPool: (instanceId=api.sqlCatalog.Instance, pool) => {

    api.sqlCatalog.Pools.set(instanceId, Object.assign({}, pool))

  },
  isDocker: () => {

    return new Promise(function(resolve, reject) {
      let is=false
      let socket=process.env.DOCKER_SOCKET || config.docker.socket
      try {
        let stats=fs.statSync(socket)
        resolve(stats.isSocket())
      }
      catch(err) {
        if (err.code==='ENOENT') {
          api.log('warn', `(isDocker) No open socket at ${socket}... \n`+
          chalk`Provided the Docker Container Engine is installed, try {italic.yellow 'engine --start'}`)
          resolve(false)
        } else {
          reject(err)
        }
      }
    })

  },
  isInstance: (containerId) => {

    return new Promise(function(resolve, reject) {
      return resolve(api.getInstanceInfo(containerId).State==='running'? true: false)
    })

  },
  latestInstances: async (limit=3) => {

    return Promise.resolve(docker.listContainers({"last": limit}))
    .then( (containers) => {
      let latest=[]
      // have done nothing to assure these last! assumes fifo based on nothing
      for (containerInfo of containers) {
        if (containerInfo.Labels["com.microsoft.product"]==="Microsoft SQL Server") {
          latest.push({Id: containerInfo.Id, $$DATE: containerInfo.Created})
        }
      }
      return latest
    })

  },
  latestImage: () => {

    return new Promise(function(resolve, reject) {
      docker.listImages()
      .then( (images) => {
        images.forEach( (image) => {
          if (image.RepoTags && image.RepoTags.includes(`${config.docker.pull.repo}:latest`)) {
            return resolve(image)
          }
        })
      })
    })

  },
  listInstance: (containerId) => {

    let list=[]
    if (api.sqlCatalog.ContainerInfos.size>0) {
      for ([id, info] of api.sqlCatalog.ContainerInfos) {
        if (!containerId || containerId===id) {
          list.push(info)
        }
      }
    }
    return list

  },
  listFiles: async (folder, filter) => {

    return new Promise( function(resolve, reject) {
      try {
        fs.readdir(path.resolve(folder), (err, files) => {
          if (err) return reject(err)
          let list=[]
          files.forEach( function(fileName) {
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
  listImage: (imageId) => {

    let list=[]
    if (api.sqlCatalog.Images.size>0) {
      for (let [id, image] of api.sqlCatalog.Images) {
        if (!imageId || imageId===id) {
          list.push(image)
        }
      }
    }
    return list

  },
  listPool: (containerId) => {

    let list=[]
    if (api.sqlCatalog.Pools.size>0) {
      for (let [id, pool] of api.sqlCatalog.Pools) {
        if (!containerId || containerId==id) {
          list.push([id, pool])
        }
      }
    }
    return list

  },
  log: (mode, data) => {

    try {
      if (Object.keys(api.logger).length===0) {
        if (mode==='error') {
          console.error(data)
          console.error(new Error().trace)
        } else {
          console.log(mode, data)
        }
      } else {
        // made for vorpal's add-in log
        switch (mode) {
          case ('confirm'):
            api.logger.confirm(data)
            break
          case ('debug'):
            if (config.vorpal.loglevel===10) {
              api.logger.debug(data)
            }
            break
          case ('error'):
            api.logger.error(data)
            break
          case ('info'):
            api.logger.info(data)
            break
          case ('log'):
            api.logger.log(data)
            break
          case ('warn'):
            api.logger.warn(data)
            break
        }
      }
    }
    catch (e) {
      console.error(e)
    }

  },
  mssqlConf: (containerId, confArgs) => {

    // mssql-conf not compiled in RTM image and no make? config.mssql.conf trying .py file...
    new Promise(function(resolve, reject) {
      if (api.sqlCatalog.ContainerInfos.has(containerId)) {
        let options = {
          Cmd: ['bash', '-c', `${config.mssql.conf} ${confArgs}`],
          AttachStdout: true,
          AttachStderr: true
        };
        let container=docker.getContainer(containerId)
        container.exec(options, function(err, exec) {
          if (err) return
          exec.start(function(err, stream) {
            if (err) return
            container.modem.demuxStream(stream, process.stdout, process.stderr)
            // return resolve(exec.inspect(() => {})) // empty callback seems to supress output of meta into my stdout
            return resolve(exec.inspect(function(err, data) {
              if (err) return
              return data
            }))
          })
        })
      }
    })

  },
  mssqlFiles: (containerId, folder, filter) => {

    return new Promise(async function(resolve, reject) {
      try{
        if (api.sqlCatalog.ContainerInfos.has(containerId)) {
          let options = {
            Cmd: ['bash', '-c', `ls -lb ${folder}| grep ${filter}`],
            AttachStdout: true,
            AttachStderr: true
          };
          let container=docker.getContainer(containerId)
          container.exec(options, (err, exec) => {
            if (err) reject(err)
            exec.start( async (err, stream) => {
              if (err) reject(err)
              container.modem.demuxStream(stream, process.stdout, process.stderr)
              return resolve(await exec.inspect())
            })
          })
        }
      }
      catch (err){
        reject(err)
      }
    })

  },
  pullImage: async () => {

    return new Promise(function(resolve, reject) {
      try {
        docker.pull(`${config.docker.pull.repo}:${config.docker.pull.tag}`, function(err, stream) {
          if (err) {
            store.pulls.put(err)
            reject(err)
          }
          // ???app aborts here if engine missing/stopped, uncaught by any of contraptions in place
          // TypeError: Cannot read property 'pipe' of null
          // at Modem.followProgress
        docker.modem.followProgress(stream, onFinished)
          function onFinished(err, output) {
            if (err) {
              store.pulls.put(err)
              reject(err)
            }
            store.pulls.put(output)
            resolve(output)
          }
        })
      }
      catch(err) {
        reject(err)
      }
    })

  },
  removeInstance: async (containerId) => {

    if (api.sqlCatalog.ContainerInfos.has(containerId)) {
      await docker.getContainer(containerId).remove()
    }

  },
  restartInstance: async (containerId=api.sqlCatalog.Instance) => {

    if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
      api.log('confirm', `(restartInstance) ${containerId}`)
      return await docker.getContainer(containerId).restart()
      .then( async() => {
        return await api.tailLog(containerId)
      })
      .then( async () => {
        return await api.intern(api.sqlCatalog.Instance)
      })
      .catch( async (err) => {
        api.log('error', `(restartInstance) malfunction`)
        api.log('error', err)
      })
    } else {
      api.log('warn', chalk`(restartInstance) ${containerId} is not running, did you mean {italic.bold instance --start}`)
    }

  },
  runImage: async (imageId) => {

// mountpoint wants to be under docker to get read-write control
// ./sqlBackups - a sym-link in app folder on host, also wants mountpoint to be in docker bowels
// creating a docker volume with device spec automajically puts mountpoint here
// bwunder@linux-niun:~/sqlpal> docker volume create sqlBackups
// bwunder@linux-niun:~/sqlpal> ln -s /var/lib/docker/volumes/sqlBackups/_data sqlBackups
// bwunder@linux-niun:~/sqlpal> docker inspect sqlBackups
// .Mountpoint is then set to ContainerInfo.Mounts[0].Source on container create
// bound container path is set to ContainerInfo.Mounts[0].Source on container create
// certificate share
// bwunder@linux-niun:~/sqlpal> docker volume create private
// bwunder@linux-niun:~/sqlpal> ln -s /var/lib/docker/volumes/private/_data private
    return new Promise( async function(resolve, reject) {
      try {
        if (!imageId) {
          reject(new Error('unknown imageId'))
        } else {
          return getPort(config.docker.mssql.port)
          .then( (hostPort) => {
            let mounts= [
              {
                Target:   config.volume.backup.path,
                Source:   config.volume.backup.volume,
                Type:     "volume",
                ReadOnly: false
              },
              {
                Target:   config.volume.private.path,
                Source:   config.volume.private.volume,
                Type:     "volume",
                ReadOnly: true
              }
            ]
            /*
              `MSSQL_MEMORY_LIMIT_MB=`  in MB, but default is 80% of available
              `MSSQL_LCID=`  default is 1033
              `MSSQL_COLLATION=` overrides collation of LCID
              `MSSQL_TCP_PORT=` ??? looks like this will mess with PortBindings below ???
              `MSSQL_IP_ADDRESS` ??? IPv4 only but docker engine dishes out classB vlan IPs by default
              `MSSQL_ENABLE_HADR=` 0 or 1
              `MSSQL_AGENT_ENABLED=` false is default
              `MSSQL_MASTER_DATA_FILE=` master db data
              `MSSQL_MASTER_LOG_FILE=` master db log
            */
            return docker.createContainer({
              Image: imageId,
              Env: [
                `ACCEPT_EULA=${config.mssql.acceptEULA}`,
                `MSSQL_SA_PASSWORD=${config.mssql.pool.password}`,
                `MSSQL_PID=${config.mssql.PID}`,
                `MSSQL_BACKUP_DIR=${config.volume.backup.path}`,
                `MSSQL_DATA_DIR=${config.mssql.data.path}`,
                `MSSQL_LOG_DIR=${config.mssql.log.path}`,
                `MSSQL_DUMP_DIR=${config.mssql.dump.path}`
              ],
              HostConfig: {
                Mounts: mounts,
                PortBindings: {
                  "1433/tcp": [
                    {
                      HostPort: hostPort.toString()
                    }
                  ]
                }
              },
            })
          })
          .then( async (container) => {
            await container.start()
            try {
              await api.elevate(`ls -dH ${config.volume.private.path}`)
            } catch (err) {
              if (err.code === 'ENOENT') {
                api.log('log', `creating link from ${path.resolve(config.volume.private.path)} to ${config.volume.private.link}`)
                await api.elevate(`ln -s ${config.volume.private.link} ${path.resolve(config.volume.private.path)}`)
              } else {
                api.log('error', err)
              }
            }
            finally {
              await api.elevate(`openssl genrsa -aes256 -out ${caKey} 2048`)
              fs.accessSync(caKey, fs.constants.F_OK)
              await api.elevate(`openssl req -new -key ${caKey} -x509 -days 1000 -out ${caCert}`)
              resolve()
            }
            try {
              await api.elevate(`ls -dH ${config.volume.private.path}`)
            } catch (err) {
              if (err.code === 'ENOENT') {
                api.log('log', `creating link from ${path.resolve(config.volume.private.path)} to ${config.volume.private.link}`)
                await api.elevate(`ln -s ${config.volume.private.link} ${path.resolve(config.volume.private.path)}`)
              } else {
                api.log('error', err)
              }
            }
            finally {
              await api.elevate(`openssl genrsa -aes256 -out ${caKey} 2048`)
              fs.accessSync(caKey, fs.constants.F_OK)
              await api.elevate(`openssl req -new -key ${caKey} -x509 -days 1000 -out ${caCert}`)
              resolve()
            }
          })
        }
      }
      catch (err) {
        reject(err)
      }
    })

  },
  setEngine: async (action=`status`) => {

    /*
      --tls                Use TLS; implied by --tlsverify
      --tlscacert string   Trust certs signed only by this CA (default "$HOME/.docker/ca.pem")
      --tlscert string     Path to TLS certificate file (default "$HOME/.docker/cert.pem")
      --tlskey string      Path to TLS key file (default "$HOME/.docker/key.pem")
      --tlsverify          Use TLS and verify the remote
    */
    return new Promise(function(resolve, reject) {
      api.log('debug', `(setEngine) sudo service docker ${action}`)
      let args=[ `service`, `docker`, action ]
      // if (action==='start') {
      //   args.push(`--tls`)
      //   args.push(`--tlscacert`)
      //   args.push()
      //   args.push(`--tlscert`)
      //   args.push()
      //   args.push(`--tlskey`)
      //   args.push()
      // }
      resolve(childProcess.spawnSync(`sudo`, args, {
        stdio: [0, 1, 2]
      }, (err) => {
        if (err) reject(err)
      }))
    })

  },
  shell: async (containerId, command) => {

    return new Promise(function(resolve, reject) {
      try {
        if (api.sqlCatalog.ContainerInfos.has(containerId)) {
          let cmdArgs= [`exec`,
            `--interactive`,
            `--tty`,
            containerId ]
          api.log('debug', `(shell) docker ${cmdArgs.concat(command.split(' ')).join(' ')||''}`)
          resolve(childProcess.spawnSync(`docker`, cmdArgs.concat(command.split(' ')), {stdio: 'inherit', shell: true}))
        }
      }
      catch(err) {
        reject(err)
      }
    })

  },
  sqlCatalog: {},
  startInstance: async (containerId=api.sqlCatalog.Instance) => {

    if (api.sqlCatalog.ContainerInfos.get(containerId).State!='running') {
      api.log('confirm', `(startInstance) ${containerId}`)
      return await docker.getContainer(containerId).start()
      .then( async() => {
        return await api.tailLog(containerId)
      })
      .then( async () => {
        return await api.intern(api.sqlCatalog.Instance)
      })
      .catch( async (err) => {
        api.log('warn', `(startInstance) malfunction`)
        api.log('error', err)
      })
    } else {
      api.log('warn', chalk`(startInstance) ${containerId} is already running, did you mean {italic.bold instance --restart} ?`)
    }

  },
  stopInstance: async (containerId=api.sqlCatalog.Instance) => {

    if (containerId && api.sqlCatalog.ContainerInfos.has(containerId)) {
      if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
        api.log('confirm', `(stopInstance) ${containerId}`)
        return docker.getContainer(containerId).stop()
        .then( async () => {
          await api.intern(api.sqlCatalog.Instance)
        })
      }
    }

  },
  startSQLPad: () => {

      pem.createCertificate(config.pem, function(err, keys){

        api.log('confirm', `(sqlpad) generate Certificate for SQLPad SSL`)
        if (config.sqlpad.sqlpad) {
          config.sqlpad.sqlpad.kill()
        }
        const sqlpadArgs = []
        if (config.loglevel===10) {
          config.sqlpad.debug=true
        }
        // when IP not explicitly set, sqlpad IS reachable from V8 browser anywhere with a network route to host
        // I am able to get a sql server connection when in same dhcp subnet using my ipad anyway...
        if (config.sqlpad.localHostOnly) {
          config.sqlpad["ip"]="127.0.0.1"
        }
        Object.keys(config.sqlpad).forEach( (key) => {
          if (config.sqlpad[key]) {
            sqlpadArgs.push( key.length==1? `-${key}`: `--${key}` )
            sqlpadArgs.push( config.sqlpad[key])
          }
        })
        sqlpad = childProcess.spawn('sqlpad', sqlpadArgs)
        sqlpad.on('error',  (data) => {
          api.log('error', chalk`{cyan.italic (sqlpad)} {red error}`)
          api.log('error', err)
        })
        sqlpad.stdout.on('data', (data) => {
          if (/Welcome/.test(data)) {
            api.log('log', chalk.cyan.italic(data))
            api.log('info', chalk`{italic (sqlpad)  debug: ${config.sqlpad.debug}  localHostOnly: ${(config.sqlpad.localHostOnly)}}  {yellow.italic use a browser built with V8}`)
          } else {
            if (config.sqlpad.debug) {
              api.log('debug', chalk`{cyan.italic (sqlpad)} {gray ${data}}`)
            }
          }
        })
        sqlpad.stderr.on('data', (err) => {
          api.log('log', chalk`{cyan.italic (sqlpad)}  {red error}\n${err}`)
        })
        sqlpad.on('exit', (code) => {
          api.log('warn', chalk`{cyan.italic (sqlpad)} {gray server has exited}`)
          config.sqlpad.sqlpad=undefined
        })
        config.sqlpad.sqlpad=sqlpad
      })

  },
  tailLog: async (containerId, filter=true) => {

    return new Promise( async function(resolve, reject) {
      let container = await docker.getContainer(containerId) // passing id to promise returns 'logger is not defined'
      if (container) {
        let logStream = new stream.PassThrough()
        container.logs({
            tail: 0,
            follow: true,
            stdout: true,
            stderr: true
          }, function(err, stream){
            if(err) {
              api.log('error', `(tailLog) error`)
              api.log('error', err)
              reject(err)
            }
            container.modem.demuxStream(stream, logStream, logStream)
            stream.on('data', function(data){
              // if (filter && (/recover/i.test(data) || /ready for client connections/.test(data))) {
              if (filter && (/This is an informational message only\. No user action is required\./i.test(data))) {
                api.log('log', data.toString().replace('This is an informational message only. No user action is required.', ''))
              } else if (!filter) {
                api.log('log', data.toString())
              }
            });
            stream.on('end', function(data){
              resolve('end log follow')
            });
            setTimeout(function() {
              if (stream) {
                stream.emit('end', 'Timeout waiting for startup recovery'.red)
              }
            }, 10000) // 10 seconds max wait
        })
      }
    })

  },
  updateNPM: async () => {

    return new Promise(function(resolve, reject) {
      childProcess.exec(`npm update`, {}, (err, result) => {
        if (err) resolve(err.message)
        store.npm.put(result)
        resolve(result|| 'up to date')
      })
    })

  },


}
