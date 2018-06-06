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
  cliAid: () => {
    return chalk`
      {italic.bold ${'engine    --start'.padEnd(40)}} Start the Docker Container Engine Instance
      {italic.bold ${'image     --pull'.padEnd(40)}} get '${config.docker.pull.repo}:latest' image from dockerhub
      {italic.bold ${'image     --run    [image-id]'.padEnd(40)}} Create and start a new SQL Server container from an image
      {italic.bold ${'container --target [container-id]'.padEnd(40)}} Target the SQL Server Container for CLI queries
      {italic.bold ${'catalog'.padEnd(40)}} View Catalog Maps of Local SQL Server Images, Containers and Connection Pools
      {italic.bold ${'container --start  [container-id]'.padEnd(40)}} Start exsting SQL Server Container
      {italic.bold ${'sqlpad    --start [ssl-certificate-password]'.padEnd(40)}} Start a SQLPad web server
      ${(api.sqlpad)?chalk`or go to sqlpad at {italic.underline https://127.0.0.1:${config.sqlpad['https-port']}} in a Chromium browser`:''}

      Type  {italic.bold --help} for epistemological CLI usage or {italic.bold help} for alphabetic command listing.
      Use {bold.italic help <command>} or {italic.bold <command> --help} for each CLI command\'s Usage details.
      Command args are documented as either {italic.bold [optional]} when square bracketed or {italic.bold <required>} when angle bracketed.

      UPPERCASE 'GO' and UPPERCASE 'USE' will pass-through batch as inline tSQL. CLI responds only to lowercase 'go' or 'use'.

      {underline TAB Autocompletion}
      Type enough characters to identify the command, argument or option you desire and then {italic.bold TAB} to Autocomplete.
      Use {italic.bold TAB} Autocompletion else copy & paste Docker identities from a useful {italic.bold catalog} command view.
      Use {italic.bold <command> --TAB TAB} (two dashes & 2 or 3 tabs) to prompt with available command options.
      Use {italic.bold <command> TAB TAB} (no dashes, just 2 or 3 tabs) to prompt with all usable argument values.
      {italic.bold TAB TAB} (no command, just 2 or 3 tabs) will list command names only, no describing text.`

  },
  commandAid: (cmds) => {

    let admin=[], builtin=[], cli=[], cat=[], etl=[], inject=[], terminate=[]
    cmds.forEach( (cmd) => {
      switch(true) {
        case(['log', 'file', 'sqlpad'].includes(cmd._name.toLowerCase())):
          admin.push(`${chalk.cyan(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['help', 'exit', 'loglevel'].includes(cmd._name.toLowerCase())):
          builtin.push(`${chalk.italic(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['query', 'script'].includes(cmd._name.toLowerCase())):
          inject.push(`${chalk.magenta(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['go', 'run', 'sqlcmd', 'issql'].includes(cmd._name.toLowerCase())):
          terminate.push(`${chalk.green(cmd._name).padEnd(20)}${cmd._description}`)
          break
        // case(['bcp', 'bulk'].includes(cmd._name.toLowerCase())):
        //   etl.push(`${chalk.yellow(cmd._name).padEnd(20)}${cmd._description}`)
        //   break
        case(['engine', 'image', `container`].includes(cmd._name.toLowerCase())):
          cat.push(`${chalk.blue(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['about', 'batch', `catalog`, 'configuration', `history`, 'use', 'certificate'].includes(cmd._name.toLowerCase())):
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
      ${chalk.underline(`CLI`).padEnd(20).padStart(12)} ClI scoped query instrumentation commands
      \t${cli.join('\n\t').padStart(5)}
      ${chalk.underline(`Inject`).padEnd(20).padStart(12)} Commands that Overwrite the Batch with app stored t-SQL scripts
      \t${inject.join('\n\t').padStart(5)}
      ${chalk.underline(`Terminate`).padEnd(20).padStart(12)} Commands to Compile Batch as T-SQL & submit to Target
      \t${terminate.join('\n\t').padStart(5)}
      ${chalk.underline(`Docker`).padEnd(20).padStart(12)} Container Scoped Management Commands
      \t${cat.join('\n\t').padStart(5)}
      ${chalk.underline(`Target`).padEnd(20).padStart(12)} Target SQL Server Administration Commands
      \t${admin.join('\n\t').padStart(5)}
      ${chalk.underline(`Vorpal`).padEnd(20).padStart(12)} Vorpal Built-ins
      \t${builtin.join('\n\t').padStart(5)}
      \n  quickstart:`+ api.cliAid() ]

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

    // resolve(childProcess.execSync(`sudo ${bashCommand}`))
    // piping to grep doesn't work in spawnSync+split - may need to filter returned results instead
    // openssl dialogs don't work in execSync - elevate needed is to save openssl output into the symlink
    //return Promise.resolve(childProcess.spawnSync(`sudo`, bashCommand.split(' '), {stdio: [0, 1, 2]}))
    return new Promise(function(resolve, reject) {
      try {
        resolve(childProcess.spawnSync(`sudo`, bashCommand.split(' '), {
          stdio: [0, 1, 2]
        }, (err) => {
          if (err) {
            api.log('error', `(elevate) 'sudo ${bashCommand}'`)
            api.log('error', err)
          }
        }))
      }
      catch(err) {
        api.log('error', `(elevate) 'try-catch'`)
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
      try {
        let caKey = path.resolve('private',`CA-key.pem`)
        let caCert = path.resolve('private','CA-cert.pem')
        let private =  await api.elevate(`ls -dH private`)
        if (private.status===2) {
          await api.elevate(`ln -s ${config.volume.private.link} ${path.resolve('private')}`)
        }
        if ((await api.elevate(`ls ${caKey}`)).status===2 &&
            (await api.elevate(`ls ${caCert}`)).status===2) {
          await api.elevate(`openssl genrsa -aes256 -out ${caKey} 2048`)
          if ((await api.elevate(`ls ${caKey}`)).status===0) {
            await api.elevate(`openssl req -new -key ${caKey} -x509 -days 1000 -out ${caCert}`)
            resolve(api.log('confirm', `(genCA) CA is Ready`))
          }
          reject(new Error('(genCA) CA certificate not generated'))
        } else {
          reject(new Error('(genCA) abort, invalid CA state for request'))
        }
      } catch (err) {
        api.log('error', `(genCA) error ${err.message}`)
        reject(err)
      }
    })

  },
  genCertificate: (name, keyPassword) => {

    return new Promise(async function(resolve, reject) {
      try {
        let caKey = path.resolve(`private/CA-key.pem`)
        let caCert = path.resolve('private/CA-cert.pem')
        let key = path.resolve(`private/${name}-key.pem`)
        let signingReq = path.resolve(`private/${name}-signingReq.csr`)
        let cert = path.resolve(`private/${name}-cert.pem`)
        let cnf =  path.resolve(`config/openssl.cnf`)
        if ((await api.elevate(`ls ${caCert}`)).status===0 &&
            (await api.elevate(`ls ${key}`)).status===2 &&
            (await api.elevate(`ls ${cert}`)).status===2) {
          await api.elevate(`openssl genrsa -aes256 -passout pass:${keyPassword} -out ${key} 2048`)
          if ((await api.elevate(`ls ${key}`)).status===0) {
            await api.elevate(`openssl req -new -config ${cnf} -key ${key} --passin pass:${keyPassword} -out ${signingReq}`)
          }
          if ((await api.elevate(`ls ${signingReq}`)).status===0) {
            await api.elevate(`openssl x509 -req -days 365 -in ${signingReq} -CA ${caCert} -CAkey ${caKey} -CAcreateserial -out ${cert}`)
            resolve(api.log('confirm', `(genCertificate) ${name} certificate ready`))
          }
          reject(new Error('(genCertificate) certificate not generated'))
        } else {
          reject(new Error('(genCertificate) abort, invalid state for request'))
        }
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
  getEnvVariable: async (containerId, variable) => {

    return new Promise(function(resolve, reject) {
      if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
        let cmdArgs = ['exec', containerId, `/bin/bash`, `-c`, `echo ${variable}`]
        let spawn = childProcess.spawn(`docker`, cmdArgs)
        spawn.stdout.on('data', (data) => {
          resolve(data.toString().replace(`\n`, ``))
        })
      }
    })

  },
  getInstanceInfo: (containerId) => {

    containerId = containerId || api.sqlCatalog.Instance
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
            top=container.top("-x")
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
        api.log('log', chalk`Entering interactive session as '{italic root}'
          SQL Server container ${containerId}
          {bold.italic bcp} & {bold.italic sqlcmd} included with official sql image now in $PATH as symlinks in '/usr/bin'
          \t{italic.bold -U sa -P $MSSQL_SA_PASSWORD} (from the container\'s environment) can be used for both
          Type 'exit' to close interactive session and resume ${name} at host`)
        return resolve(childProcess.spawnSync(`docker`, spawnArgs, {stdio: [0, 1, 2]}))
//        return resolve(childProcess.spawnSync(`docker`, spawnArgs, {stdio: ['inherit', 'inherit', 'inherit']}))
      }
    })

  },
  intern: async (instanceId) => {

    if (await api.isDocker()) {
      instanceId = instanceId || await store.pools.getLastInstanceId()
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
              // if is only running, use it
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
// every unique pool config should get saved and maintained to history from first openPool
// is putting all config too much? aren't there synchro problems? for restart after config edit?
              store.pools.update(config)
            } else {
              api.log('warn', chalk`(intern) Target SQL Container is not 'running', try {italic.bold container --start}`)
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

    store.pools.put(instanceId, pool)
    api.sqlCatalog.Pools.set(instanceId, Object.assign({}, pool))
    store.pools.put()
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
  mssqlFiles: (containerId=api.sqlCatalog.Instance, folder, filter='.') => {

    return new Promise(async function(resolve, reject) {
      try{
        api.log('log', chalk.gray(`\tcontainerId: ${containerId} \n\tfolder: ${folder} \n\tfilter: ${filter}`) )
        // if (!containerId) containerId = api.sqlCatalog.Instance
        if (api.sqlCatalog.ContainerInfos.get(containerId).State=='running') {
          let options = {
            Cmd: ['bash', '-c', `ls -lb ${folder}| grep ${filter}`],
            AttachStdout: true,
            AttachStderr: true
          };
          let container = await docker.getContainer(containerId)
          let exec = await container.exec(options)
          exec.start( (err, stream) => {
            if (err) reject(err)
            container.modem.demuxStream(stream, process.stdout, process.stderr)
            stream.on('end', () => {
              resolve()
            })
            stream.on('error', (err) => {
              reject(err)
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
      api.log('warn', chalk`(restartInstance) ${containerId} is not running, did you mean {italic.bold container --start}`)
    }

  },
  runImage: async (imageId) => {

    // all get the same shared certificate and backup storage space
    // mountpoint paths are docker defaults because I get read-write control from the containers
    // sym-link access from this app's folder on host must elevate to do most things to/in the root owned docker volumes
    // bwunder@linux-niun:~/sqlpal> docker volume create sqlBackups
    // bwunder@linux-niun:~/sqlpal> ln -s /var/lib/docker/volumes/sqlBackups/_data sqlBackups
    // certificate share
    // ./private - a sym-link in this app's folder on host to root owned docker volumes mounted to all sql containers
    // bwunder@linux-niun:~/sqlpal> docker volume create private
    // bwunder@linux-niun:~/sqlpal> ln -s /var/lib/docker/volumes/private/_data private
    return new Promise( async function(resolve, reject) {
      try {
        if (!imageId) {
          reject(new Error('unknown imageId'))
        } else {
          return getPort()
          .then( (hostPort) => {
            let mounts= [
              {
                Target:   config.volume.sqlBackups.path,
                Source:   `sqlBackups`,
                Type:     `volume`,
                ReadOnly: false
              },
              {
                Target:   config.volume.private.path,
                Source:   `private`,
                Type:     `volume`,
                ReadOnly: true
              }
            ]
            let enviro = []
            // omit the empties else kabloey
            for (let envirovar of Object.keys(config.mssql.env)) {
              if (config.mssql.env[envirovar]) {
                enviro.push(`${envirovar}=${config.mssql.env[envirovar]}`)
              }
            }
            return docker.createContainer({
              Image: imageId,
              Env: enviro,
              HostConfig: {
                Mounts: mounts,
                PortBindings: {
                  "1433/tcp": [
                    {
                      HostPort: hostPort.toString()
                    }
                  ]
                }
              }
            })
          })
          .then( container => {
            resolve(container.start())
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
    return new Promise( async (resolve, reject) => {
      let args=[ `service`, `docker`, action ]
      childProcess.spawnSync(`sudo`, args, { stdio: [0, 1, 2]})
      api.sqlCatalog.Pools = new Map()
      resolve(await api.intern(api.sqlCatalog.Instance))
    })
      // if (action==='start') {
      //   args.push(`--tls`)
      //   args.push(`--tlscacert`)
      //   args.push()
      //   args.push(`--tlscert`)
      //   args.push()
      //   args.push(`--tlskey`)
      //   args.push()
      // }
      // childProcess.spawnSync(`sudo`, args, { stdio: [0, 1, 2]})
      //   // }, (err) => {
      //   //   if (err) reject(err)
      // resolve(await api.intern(api.sqlCatalog.Instance))
        //  })
    // })

  },
  shell: async (containerId, command) => {

    return new Promise(function(resolve, reject) {
      if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
        let cmdArgs = [`exec`, `--interactive`, `--tty`, `${containerId}`].concat(command.split(' '))
        resolve(childProcess.spawnSync(`docker`, cmdArgs, {stdio: [0, 1, 2]}))
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
      api.log('warn', chalk`(startInstance) ${containerId} is already running, did you mean {italic.bold container --restart} ?`)
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
  startSQLPad: async (certPassword) => {

    try {
      let sqlpadArgs = []
      await api.elevate(`cp ${path.resolve('private/sqlpad-key.pem')} ${path.resolve(config.sqlpad.dir)}`)
      await api.elevate(`cp ${path.resolve('private/sqlpad-cert.pem')} ${path.resolve(config.sqlpad.dir)}`)
      await api.elevate(`chmod a+x ${path.resolve(config.sqlpad.dir, 'sqlpad-key.pem')} ${path.resolve(config.sqlpad.dir, 'sqlpad-cert.pem')}`)
      config.sqlpad["key-path"] = `${path.join(config.sqlpad.dir, 'sqlpad-key.pem')}`
      config.sqlpad["cert-path"] = `${path.join(config.sqlpad.dir, 'sqlpad-cert.pem')}`
  // use that vorpal whizbang to get the cert passphrase from user
      config.sqlpad["cert-passphrase"] = certPassword
      if (config.sqlpad.localHostOnly) {
        config.sqlpad["ip"]="127.0.0.1"
      }
      Object.keys(config.sqlpad).forEach( (key) => {
        if (config.sqlpad[key]) {
          sqlpadArgs.push( key.length==1? `-${key}`: `--${key}` )
          sqlpadArgs.push( config.sqlpad[key])
        }
      })
      api.sqlpad = childProcess.spawn('sqlpad', sqlpadArgs)
      api.sqlpad.on('error',  (data) => {
        api.log('error', chalk`{cyan.italic (sqlpad)} {red error}`)
        api.log('error', err)
      })
      api.sqlpad.stdout.on('data', (data) => {
        if (/Welcome/.test(data)) {
          api.log('log', chalk.cyan.italic(data))
          api.log('info', chalk`{italic (sqlpad)  debug: ${config.sqlpad.debug}  localHostOnly: ${(config.sqlpad.localHostOnly)}}  {yellow.italic use a browser built with V8}`)
        } else {
          if (config.sqlpad.debug) {
            api.log('debug', chalk`{cyan.italic (sqlpad)} {gray ${data}}`)
          }
        }
      })
      api.sqlpad.stderr.on('data', (err) => {
        api.log('log', chalk`{cyan.italic (sqlpad)}  {red error}\n${err}`)
      })
      api.sqlpad.on('exit', (code) => {
        api.log('warn', chalk`{cyan.italic (sqlpad)} {gray server has exited}`)
        api.sqlpad=undefined
      })
    }
    catch(err) {
      api.log('error', `(startSQLPad) error`)
      api.log('error', err)
    }

  },
  tailLog: async (containerId, tail=0, infoOnly=true) => {

    return new Promise( async function(resolve, reject) {
      let container = await docker.getContainer(containerId) // passing id to promise returns 'logger is not defined'
      if (container) {
        let logStream = new stream.PassThrough()
        container.logs({
            tail: tail,
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
              switch (true) {
                case (infoOnly && /This is an informational message only\./i.test(data)):
                  api.log('log', data.toString().replace('This is an informational message only. No user action is required.', ''))
                  break
                case (infoOnly && /error\./i.test(data)):
                  api.log('error', data.toString())
                  break
                case (!infoOnly):
                  api.log('log', data.toString())
                  break
                default:
                  break
              }
            })
            stream.on('end', function(data){
              resolve(stream.end)
            })
            setTimeout(function() {
              if (stream) {
                stream.emit('end')
              }
            }, config.docker.tailSeconds*1000)
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

  }

}
