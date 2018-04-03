////NPM
const Docker = require('dockerode')
const chalk = require('chalk')
const getPort = require('get-port')
const pem = require('pem')
const prettyData = require('pretty-data')
////core
const stream = require('stream')
const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
////local
const config = require('./config')

const docker = new Docker()
let sqlpad

module.exports = exports = api = {

  bandAid: chalk.green(`\n\t\t\t l Q _ \n\t\t\t   |   \n\t\t\t  / \\  \n`),
  batch: [''],
  checkNPM: async (depth) => {

    return new Promise(function(resolve, reject) {
      if (typeof depth=='boolean') depth=0
      childProcess.exec(`npm outdated`, {}, (err, result) => {
        if (err) resolve(err.message)
        resolve(result|| 'up to date')
      })
    })

  },
  commandAid: (cmds) => {

    let admin=[], builtin=[], cli=[], docker=[], extern=[], inject=[], terminate=[]
    cmds.forEach( (cmd) => {
      switch(true) {
        case(['HELP', 'EXIT', 'LOGLEVEL'].includes(cmd._name.toUpperCase())):
          builtin.push(`${cmd._name.padEnd(20)}${cmd._description}`)
          break
        case(['QUERY', 'SCRIPT'].includes(cmd._name.toUpperCase())):
          inject.push(`${chalk.magenta(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['GO', 'RUN', 'SQLCMD', 'ISSQL'].includes(cmd._name.toUpperCase())):
          terminate.push(`${chalk.green(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['BCP', 'BULK', 'ELOG'].includes(cmd._name.toUpperCase())):
          extern.push(`${chalk.yellow(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['CONFIG','ENGINE', 'IMAGE', `INSTANCE`].includes(cmd._name.toUpperCase())):
          docker.push(`${chalk.blue(cmd._name).padEnd(20)}${cmd._description}`)
          break
        case(['CACHE', 'ABOUT', 'USE', `HISTORY`].includes(cmd._name.toUpperCase())):
          cli.push(`${chalk.red(cmd._name).padEnd(20)}${cmd._description}`)
          break
        default:
          if (cmd._name) {
            admin.push(`${chalk.cyan(cmd._name).padEnd(20).cyan}${cmd._description}`)
          }
          break

      }
    })
    return [
      chalk`\tEntered text is processed as a {bold.italic sqlpal} CLI command else accumulated into the Batch - an array of text lines.
      \tAdditional non-command text typed - or lines pasted - at the prompt are accumulated as entered into the Batch.
      \tCommands may be entered at any time and are not, in general, destructive to the Batch.
      \tWhen a {italic.green terminating command} on a new line is followed by ENTER, the Batch is sent to the Target SQL Server.
      \tUpon successful query exection the Batch is logged and cleared, ready for the next batch.\n
      ${chalk.underline(`CLI`).padEnd(20).padStart(12)} {gray ClI scoped query instrumentation commands}
      \t${cli.join('\n\t').padStart(5)}
      ${chalk.underline(`External`).padEnd(20).padStart(12)} {gray ETL and Data Staging commands}
      \t${extern.join('\n\t').padStart(5)}
      ${chalk.underline(`Batch Injectors`).padEnd(20).padStart(12)} {gray Commands that Overwrite the Batch with app stored t-SQL scripts}
      \t${inject.join('\n\t').padStart(5)}
      ${chalk.underline(`Batch Terminators`).padEnd(20).padStart(12)} {gray Commands to Compile Batch as T-SQL & submit to Target}
      \t${terminate.join('\n\t')}
      ${chalk.underline(`Docker`).padEnd(20).padStart(12)} {gray Container Scoped Management Commands}
      \t${docker.join('\n\t')}
      ${chalk.underline(`Target Db`).padEnd(20).padStart(12)} {gray Target SQL Server Administration Commands}
      \t${admin.join('\n\t')}
      ${chalk.underline(`Vorpal`).padEnd(20).padStart(12)} {gray Vorpal Built-ins}
      \t${builtin.join('\n\t')}
      \n\t{gray Type}  {italic.bold --help} {gray for this Application Usage Info or} {italic.bold help} {gray for CLI command listing}
      \t{gray Use} {bold.italic help <command>} {gray or} {italic.bold <command> --help} {gray any CLI command\'s Usage details}
      \t{gray Command args are represented as [optional] or <required>, and documented as either the word if a literal or hyphenated-if-user-input}` ]

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
    return `
    `+`image    --pull`.padEnd(40).italic.inverse+` get '${config.docker.repo}:latest' from dockerhub
    `+`image    --run    [image-id]`.padEnd(40).italic.inverse +` Start a new SQL Server Instance from an image (${'listed previously'.gray})
    `+`instance --start [container-id]`.padEnd(40).italic.inverse+` Start an existing SQL Server Container (${'listed previously'.cyan})
    `+`instance --target [container-id]`.padEnd(40).italic.inverse+` Target queries at a SQL Server Container (${'listed previously'.cyan})
    `+`cache    --map`.padEnd(40).italic.inverse+` Catalog of Local SQL Server Images and Containers\n
    `+ (config.sqlpad.sqlpad)?`or go to `+`https://127.0.0.1:${config.sqlpad['https-port']}`.underline+
        `- in a browser with V8 - for a friendly SQLPad query session\n`:``+`
    \t`+`--help`.italic.inverse+` for Application Info or `+`help`.italic.inverse+` for CLI command list and\n
    \t`+`help <CLI-command>`.italic.inverse+` or `+`<CLI-command> --help`.italic.inverse+
        ` for that CLI command\'s Usage Info
    `

  },
  editFile: async (textFile) => {

    return new Promise(function(resolve, reject) {
      if (!config.editor) {
        api.log('warn', `Sorry, No config.editor configured. The file can be edited
          with a text editor of choice. Either GNU Emacs or Github.com's Atom-beta
          work for me. If your editor is in your $PATH, you can add it as .editor in
          config.json - or just provide the full path if you have adequate permissions.
          If '${textFile}' is modified, restart the app`+`after`.italic+`you save the file`)
      } else {
        api.log('warn', `opening '${textFile}' with '${config.editor}'
          Any changes will require you to restart the app after you save the file`)
        // on my laptop, if project is already open in atom, this just sets atom's focus to the textFile
        return resolve(childProcess.spawn(config.editor, [path.resolve(textFile)]))
      }
    })

  },
  editBuffer: async (contentAsText) => {

    return new Promise(function(resolve, reject) {
      let changed
      // if (typeof contentAsText==='string') {
      //   ///struck out so far with atom, emacs and neovim :(
      //   api.log('warn', `opening buffer in '${config.editor}'`)
      //   changed=childProcess.spawn(neovim, contentAsText)
      // }
      resolve('(editBuffer) not implemented')
    })

  },
  fileToBatch: async (scriptFile) => {

    return new Promise(function(resolve, reject) {
      fs.readFile(scriptFile, 'utf8', (err, script) => {
        switch (true) {
          case (err):
            api.log('warn', `${err.code||''}`+`${err.message}`.red)
            break
          case (!script):
            api.log('warn', `failed to fetch script from file ${scriptFile}`.red)
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
  getPorts: () => {

    let portMap=new Map()
    if (api.sqlCatalog.ContainerInfos.size>0) {
      for ([id, info] of api.sqlCatalog.ContainerInfos) {
        if (info.State==='running') {
          portMap.set(id, {
            Network: `${info.NetworkSettings.Networks.bridge.IPAddress}:${info.Ports[0].PrivatePort}`,
            Host: `${info.NetworkSettings.Networks.bridge.Gateway}:${info.Ports[0].PublicPort}`
          })
        }
      }
    } else {
      api.log('warn', `(getPorts) No Containers in Catalog`)
    }
    return portMap

  },
  getProcesses: async (containerId) => {
    // think this started when I tried to install pacemaker without knowing how and trying to undo it without knowing how
    // bwunder@linux-niun:~/sqlpal> docker top 2c763577db75f51c98eaeee497d9426dc97ae661659b1c0279e4120e06f8e461 -e
    // Error response from daemon: rpc error: code = 13 desc = get all pids for container: exit status 1: "json: cannot unmarshal string into Go value of type uint64\n"
    // bwunder@linux-niun:~/sqlpal> docker top 2c763577db75
    // Error response from daemon: rpc error: code = 13 desc = get all pids for container: exit status 1: "json: cannot unmarshal string into Go value of type uint64\n"
    // bwunder@linux-niun:~/sqlpal> docker top 8fc7ca29a208862ee03b0b8a6eb4875dd3d8e856c5badf1991bc18069555ec18
    // Error response from daemon: rpc error: code = 13 desc = get all pids for container: exit status 1: "json: cannot unmarshal string into Go value of type uint64\n"
    // bwunder@linux-niun:~/sqlpal>
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
          docker exec -d ${containerId} ln -sf ${config.odbc.binPath}/sqlcmd ${config.vorpal.cli.binPath}
          docker exec -d ${containerId} ln -sf ${config.odbc.binPath}/bcp ${config.vorpal.cli.binPath}
          docker exec -d ${containerId} ln -sf -T ${config.mssql.confPath} ${config.mssql.binPath}/mssql-conf`)
        api.log('info', [`Entering interactive session \n\tSQL Server container ${containerId}...`,
          `\t'bcp, 'sqlcmd', 'mssql-conf' commands soft linked to current path...`,
          `Works to pass $MSSQL_SA_PASSWORD from container\'s environment works to 'bcp' or 'sqlcmd' -P switch`.yellow,
          `Review/modify current mssql-conf settings file using 'cat /var/opt/mssql/mssql.conf'`,
          `Type 'exit' to close interactive session and resume sqlpal prompt at host`].join('\n'))
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
api.log('confirm', `(intern) api.sqlCatalog.Pools before`)
api.log('confirm', api.sqlCatalog.Pools)
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
//!!!!if just started, this fails as Global connection already exists.
              await sqldb.openPool(instanceId)
              store.configs.update(config)
            } else {
              api.log('warn', chalk`(intern) Target SQL Container is not 'running', try {italic.yellow instance --start}`)
            }
          } else {
            api.log('warn', `(intern) No SQL Server has been Targeted`)
            api.log('log', api.dockerAid())
          }
        }
      }
    }

  },
  internImages: async () => {

    let images= await docker.listImages()
    for (let image of images) {
      if (image.RepoDigests[0].startsWith(`${config.docker.repo}@`)) {
        api.log('info', chalk.gray(`(internImages) ${image.Id}`)+` (${image.Labels["com.microsoft.version"]})`)
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
        let status = info.State!='running'? chalk.red(info.Status): chalk.green(info.Status)
        api.log('info', chalk.cyan(`(internContainers) ${info.Id}`)+` (${info.Labels["com.microsoft.version"]}) ${status}`)
        api.sqlCatalog.ContainerInfos.set(info.Id, info)
      }
    }

  },
  internInstance: (instanceId=api.sqlCatalog.Instance) => {

    api.sqlCatalog.Instance = instanceId
    if (api.sqlCatalog.Instance) {
      api.log('info', `(internInstance) ${api.sqlCatalog.Instance}`)
    }

  },
  internPool: (instanceId=api.sqlCatalog.Instance, pool) => {

    api.sqlCatalog.Pools.set(instanceId, Object.assign({}, pool))
    api.log('info', `(internPool) ${instanceId}`)

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
  latestInstances: async (number=3) => {

    return Promise.resolve(docker.listContainers({"last": number}))
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
          if (image.RepoTags && image.RepoTags.includes(`${config.docker.repo}:latest`)) {
            return resolve(image)
          }
        })
      })
    })

  },
  listInstances: () => {

    let list=[]
    if (api.sqlCatalog.ContainerInfos.size>0) {
      for ([id, info] of api.sqlCatalog.ContainerInfos) {
        list.push(info)
      }
    } else {
      api.log('warn', `(listInstances) No Containers in Catalog`)
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
          return resolve(list)
        })
      }
      catch(err) {
        reject(err)
      }
    })

  },
  listImages: (filter=true) => {

    let list=[]
    if (api.sqlCatalog.Images.size>0) {
      for (let image of api.sqlCatalog.Images) {
// wtf is a boolean filter ??? must have been a brilliant idea, wonder if it is still in use ???
        if (filter) {
          list.push(image[1])
        }
      }
    } else {
      api.log('warn', `(listImages) No Images in Catalog`)
    }
    return list

  },
  listPools: () => {

    let list=[]
    if (api.sqlCatalog.Pools.size>0) {
      for (let pool of api.sqlCatalog.Pools) {
        list.push(pool)
      }
    } else {
      api.log('warn', `(listPools) No Pools in Catalog`)
    }
    return list

  },
  log: (mode, data) => {

    try {
      if (Object.keys(config.log).length===0) {
        if (mode==='error') {
          console.error(data)
          console.error(new Error().trace)
        } else {
          console.log(mode, data)
        }
      } else {
        switch (mode) {
          case ('confirm'):
            config.log.confirm(data)
            break
          case ('debug'):
            if (config.vorpal.logLevel===10) {
              config.log.debug(data)
            }
            break
          case ('error'):
            config.log.error(data)
            break
          case ('info'):
            config.log.info(data)
            break
          case ('log'):
            config.log.log(data)
            break
          case ('warn'):
            config.log.warn(data)
            break
        }
      }
    }
    catch (e) {
      console.error(e)
    }

  },
  mssqlConf: (containerId, confArgs) => {

    // mssql-conf not compiled in RTM image and no make? using the .py...
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
            // return resolve(exec.inspect(() => {})) // empty fn seems to supress output of meta into my stdout
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
// ugly errorhandling here and a few other spots
            if (err) throw err
            exec.start( (err, stream) => {
              if (err) throw err
              container.modem.demuxStream(stream, process.stdout, process.stderr)
              return resolve(exec.inspect(() => {})) // empty fn seems to supress output of meta into my stdout
            })
          })
        }
      }
      catch (err){
        api.log('warn', `(mssqlFiles) exception`)
        reject(err)
      }
    })

  },
  pullImage: async () => {

    return new Promise(function(resolve, reject) {
      docker.pull(`${config.docker.repo}:${config.docker.pullTag}`, function(err, stream) {
        if (err) {
          store.pulls.put(err)
          reject(err)
        }
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
    })

  },
  removeInstance: async (containerId) => {

    if (api.sqlCatalog.ContainerInfos.has(containerId)) {
      await docker.getContainer(containerId).remove()
    }

  },
  restartInstance: async (containerId=api.sqlCatalog.Instance) => {

    // if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
    //   api.log('confirm', `(restartInstance) ${containerId} is restarting...`)
    //   if (await docker.getContainer(containerId).restart()) {
    //     await api.tailLog(containerId)
    //   }
    // }
    if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
      api.log('confirm', `(restartInstance) restarting ${containerId}`)
      return await docker.getContainer(containerId).restart()
      .then( async () => {
        return await api.tailLog(containerId)
      })
      .catch( async (err) => {
        api.log('error', `(restartInstance) obviously a major malfunction`)
        api.log('error', err)
        await api.intern(api.sqlCatalog.Instance)
      })
    } else {
      api.log('warn', chalk`(restartInstance) ${containerId} is not running, try {italic.yellow instance --start}`)
    }

  },
  runImage: async (imageId) => {

// mountpoint wants to be under docker to get read-write control
// make ./sqlBackups a symbolic link in app folder on host, also to this same mountpoint in docker bowels
// creating a docker volume with  device spec puts mountpoint here
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
          resolve('')
        } else {
          return getPort(config.docker.sqlPort)
          .then( (hostPort) => {
            let mounts= [
              {
                Target:   config.mssql.backup.path,    // /var/opt/mssql/backup
                Source:   config.mssql.backup.volume,  // sqlBackups
                Type:     "volume",
                ReadOnly: false
              },
              {
                Target:   "/var/opt/mssql/private",
                Source:   "private",
                Type:     "volume",
                ReadOnly: true
              }
            ]
// TODO data/log volumes at host - but better to avoid in most scenarios
//             if (config.docker.bindMountMssql) {
//               mounts.push({
// // I musta got lost, I musta got lost, I musta got lost, somewhere down the line
//               })
//             }

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
                `MSSQL_BACKUP_DIR=${config.mssql.backup.path}`,
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
          .then( (container) => {
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
    return new Promise(function(resolve, reject) {
      api.log('debug', `(setEngine) sudo service docker ${action}`)
      childProcess.spawnSync(`sudo`, [ `service`, `docker`, action ], {
        stdio: [0, 1, 2]
      }, (err) => {
        if (err) reject(err)
      })
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
      api.log('confirm', `(startInstance) ${containerId} is starting...`)
      await docker.getContainer(containerId).start()
      .then(() => {
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!sql server startup not finished (maybe not even started) by the time it returns???
        return api.tailLog(containerId)
      })
      .then((top) => {
        return api.getProcesses(containerId)
      })
      .then( async (top) => {
api.log('confirm', top)
        if (top["Processes"] && top.Processes.join().includes(path.join(config.mssql.binPath, `sqlservr`))) {
          await api.intern(api.sqlCatalog.Instance)
        }
      })
      .catch( async (err) => {
        api.log('error', `(startInstance) malfunction`)
        api.log('error', err)
      })
    } else {
      api.log('warn', chalk`(startInstance) ${containerId} is already running, try {italic.yellow instance --restart}`)
    }

  },
  stopInstance: async (containerId=api.sqlCatalog.Instance) => {

    if (containerId && api.sqlCatalog.ContainerInfos.has(containerId)) {
      if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
        api.log('confirm', `(stopInstance) ${containerId} is stopping...`)
        return docker.getContainer(containerId).stop()
        .then( async () => {
          await api.intern(api.sqlCatalog.Instance)
        })
      }
    }

  },
  startSQLPad: () => {

      pem.createCertificate(config.pem, function(err, keys){

        api.log('confirm', `(sqlpad) created new self-signed SSL Certificate`)
        fs.writeFileSync(config.sqlpad[`key-path`], keys.serviceKey)
        fs.writeFileSync(config.sqlpad[`cert-path`], keys.certificate)

        if (config.sqlpad.sqlpad) {
          config.sqlpad.sqlpad.kill()
        }
        const sqlpadArgs = []
        if (config.logLevel===10) {
          config.sqlpad.debug=true
        }
        // when no explicit IP, sqlpad IS reachable from V8 browser anywhere with a network route to host
        // but I was not able to get a sql server connection
        if (config.sqlpad.localHostOnly) {
          config.sqlpad["ip"]="127.0.0.1"
        }
        // something ain't right, while logged in as admin on host I still see "Admin Registration is  Open" in browser signup???
        // when no admin set, browser allows anybody to become admin
        // if (config.sqlpad.admin) {
        // }
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
  tailLog: async (containerId) => {

    let container = await docker.getContainer(containerId) // passing id to promise returns 'logger is not defined'
    if (container && container.Status=='running') {
      let logStream = new stream.PassThrough()
      // copy-paste strikes again, you'll get the full log output twice if this handler runs
      // but the right place to watch for 'Recovery Complete' instead of the screen dump

// don't think this does anything
      logStream.on('data', async function(chunk){
        if (/SQL Server is now ready for client connections/.test(chunk.toString('utf8'))) {
          api.log('debug', chunk.toString('utf8'))
          logStream.emit('end', 'SQL Server is now ready for client connections'.inverse)
        }

      })
      container.logs({
          tail: 0,
          follow: true,
          stdout: true,
          stderr: true
        }, function(err, stream){
          if(err) {
//                logger.error(err.message)
            api.log('error', `(tailLog) error`)
            api.log('error', err)
            reject(err)
          }
          container.modem.demuxStream(stream, logStream, logStream)
          stream.on('data', function(data){
            if (/recover/i.test(data)) {
              api.log('log', data.toString())
            }
          });
          stream.on('end', function(data){
            logStream.end('log follow ending...')
          });
          setTimeout(function() {
            if (stream) {
              stream.emit('end', 'Timeout waiting for startup recovery'.red)
            }
          }, 10000) // 10 seconds max wait
      })
    }

  }

}
