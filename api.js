const Docker = require('dockerode')
const colors = require('colors')
const prettyData = require('pretty-data')

const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')

const config = require('./config')
const docker = new Docker()

let sqlpad

module.exports = exports = api = {

  bandAid: `\n\t\t\t l Q _ \n\t\t\t   |   \n\t\t\t  / \\  \n`.green,
  catalogImages: async () => {

    return Promise.resolve( docker.listImages())
    .then( (images) => { // Id keyed map of images
      Images = new Map()
      for (const image of images) {
        if (image.RepoDigests[0].startsWith(`${config.docker.repo}@`)) {
          api.log('log', `(catalogImages) ${image.Id}`.cyan+` (${image.Labels["com.microsoft.version"]})`)
          Images.set(image.Id, image)
        }
      }
      api.sqlCatalog.Images = Images
    })

  },
  catalogContainers: async () => {

    return new Promise(function(resolve, reject) {
      try {
        ContainerInfos = new Map()
        for (let [imageId, image] of api.sqlCatalog.Images) {
          docker.listContainers({
            "all": true,
            "size": true,
            "filters": { "ancestor": [`${imageId}`] }
          })
          .then( (containers) => {

            containers.forEach( (containerInfo) => {
              api.log('log', `(catalogContainers) ${containerInfo.Id}`.cyan+` (${containerInfo.Labels["com.microsoft.version"]})`)
              ContainerInfos.set(containerInfo.Id, containerInfo)
            })
          })
        }
        resolve(api.sqlCatalog.ContainerInfos=ContainerInfos)
      }
      catch (err) {
        reject(err)
      }
    })

  },
  catalogInstance: async (containerId) => {

    return Promise.resolve(api.latestContainer())
    .then ((containerInfo) => {
      let candidates=[]
      if (api.sqlCatalog.Instance) {
        candidates.push(api.sqlCatalog.Instance)
      }
      if (containerInfo) {
        candidates.push(containerInfo)
      }
      if (containerId) {
        candidates.push(containerId)
      }
      return api.sqlCatalog.Instance = candidates[0]
    })

  },
  checkNPM: (depth) => {

    if (typeof depth=='boolean') depth=0
    childProcess.exec(`npm outdated`, {}, (result) => {
      api.log('log', ``)
      api.log('log', result|| 'up to date')
    })

  },
  commandAid: (cmds) => {

    let builtins=[], names=[]
    cmds.forEach( (cmd) => {
      if (cmd._name) {
        if (['HELP', 'EXIT', 'WHO', 'VANTAGE', 'REPL', 'LOGLEVEL'].includes(cmd._name.toUpperCase())) {
          builtins.push(`${cmd._name.toUpperCase()}\t\t${cmd._description}`)
        } else {
          names.push(`${cmd._name.toUpperCase()}`.cyan + `\t\t${cmd._description}`)
        }
      }
    })
    return [
      `Entered lines not beginning with a `+`KEYWORD`.rainbow+` - as listed below in caps - are buffered to a tSQL batch.`,
      `When a `+`terminating command`.italic +` starts a line, the tSQL executes and the buffer is reset.`,
      `\t--HELP`.rainbow + `\t\tCLI usage info (provides more info than Vantage 'HELP' below)`,
      `\tDEBUG`.rainbow + ` <ON|OFF> `.yellow + `\tenable debug level logging in output`,
      `  Injector Commands - overwrite the query buffer with a previously stored query`,
      `\tQUERY`.magenta + ` [query-name] `.yellow + ` \tstored queries from client nedb (omit <query-name> arg to list)`,
      `\tSCRIPT`.magenta + ` [file-name] `.yellow + `\t'.sql' files in '${config.vantage.vorpalCLI.scriptPath}' folder (omit <file-name> arg to list)`,
      `  Terminating Commands - compile cached input to T-SQL, send to SQL Server & log queries upon execution`,
      `\tGO`.green + `      \tsubmit query using mssql Response.query(), return JSON results, clear query cache`,
      `\tRUN`.green + `     \tsubmit query using mssql Response.batch(), return JSON results,  clear query cache`,
      `\tSQLCMD`.green.italic + `   \tsubmit query using ODBC`.italic+` (Uses the Vorpal SQLCMD Command shown below)`,
      `\tTEST`.green + `    \tTest Batch syntax at SQL Server with SET NOEXEC ON, (query not executed so not cleared)`,
      `\tuse 'cache --batch clear' (below) or its alias '? -b c' to clean the cache after failed or cancelled submits`.gray,
      `  Vorpal CLI Commands`,
      `     Vantage distributed realtime CLI built-ins`.gray,
      `\t${builtins.join('\n\t')}`,
      `     SQL Server for Linux Docker Image Administration`.gray,
      `\t${names.join('\n\t')}`,
      `     Use 'HELP [command]' for Command or '[command] --HELP' for even more usage details`.gray,
      `       Command args are [optional], <required>, and either `.gray+`one word literals`.italic.gray+
      ` or `.gray+`hyphenated-user-input`.italic.gray,
      `       Literals require enough of first character(s) to be a unique to be recognized.`.gray,
      api.bandAid].join(`\n`)

  },
  compile: (cacheObject) => {

    let str=``
    if (!Array.isArray(cacheObject)) {
      Object.keys(cacheObject).forEach((key) => {
        if (!['i', 'q', 'Q'].includes(key)) {
          str+= key.length===1? ` -${key}`: ` --${key}`
          if (key!=cacheObject[key]) {
            str+= ` \'${cacheObject[key]}\'`
          }
        }
      })
    } else {
      str = cacheObject.join('\n').replace(/`/g, "'")
    }
    return str

  },
  editFile: async (textFile) => {

    return new Promise(function(resolve, reject) {
      if (!config.editor) {
        api.log('warn', `Sorry, No config.editor configured. The file can be edited
          with a text editor of choice. Github.com's Atom-beta works for me.
          If your editor is in your $PATH, you can add as .editor in config.json.
          If '${textFile}' is changed, restart the app after you save the file`)
      } else {
        api.log('warn', `opening '${textFile}' with '${config.editor}'
          Any changes will require you to restart the app after you save the file`)
        // on my laptop, if project is already open in atom, this just sets atom's focus to the textFile
        return resolve(childProcess.spawn(config.editor, [path.resolve(textFile).toString()]))
      }
    })

  },
  fileToBatch: async (scriptFile) => {

    return new Promise(function(resolve, reject) {
      fs.readFile(scriptFile, 'utf8', (err, script) => {
        if (err) reject(err)
        config.batch.splice(0)
        config.batch.push(`-- ${scriptFile}`)
        resolve(
          script.split('\n').forEach((line) => {
            config.batch.push(line)
          })
        )
      })
    })

  },
  fileToJSON: (fromFile) => {

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
  getContainerInfo: (containerId) => {

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
            imageId=api.getContainerInfo().ImageID
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
          docker exec -d ${containerId} ln -sf ${config.odbc.path}/sqlcmd ${config.vantage.vorpalCLI.binPath}
          docker exec -d ${containerId} ln -sf ${config.odbc.path}/bcp ${config.vantage.vorpalCLI.binPath}
          docker exec -d ${containerId} ln -sf -T ${config.mssql.confPath} ${config.mssql.binPath}/mssql-conf`)
        api.log('info', [`Entering interactive session \n\tSQL Server container ${containerId}...`,
          `\t'bcp, 'sqlcmd', 'mssql-conf' commands soft linked to current path...`,
          `$SA_PASSWORD from container\'s environment works with 'bcp' or 'sqlcmd' -P switch`.yellow,
          `review/modify current mssql-conf settings file using 'cat /var/opt/mssql/mssql.conf'`,
          `type 'exit' to close interactive session and resume host sqlpal prompt`].join('\n'))
        api.log('debug', `(spawnSync) docker exec --interactive --tty ${containerId} /bin/bash`)
        return resolve(childProcess.spawnSync(`docker`, spawnArgs, {stdio: ['inherit', 'inherit', 'inherit']}))
      }
    })

  },
  isDocker: () => {

    return new Promise(function(resolve, reject) {
      let is=false
      let socket=process.env.DOCKER_SOCKET || config.docker.socket
      let stats=fs.statSync(socket)
      if (!stats.isSocket()) {
        api.log('log', `(isDocker 1) Docker Engine not running at `.red+`'${socket.gray}'`)
      }
      resolve(stats.isSocket())
    })

  },
  isInstance: (containerId) => {

    return new Promise(function(resolve, reject) {
      return resolve(api.getContainerInfo(containerId).State==='running'? true: false)
    })

  },
  latestContainer: async () => {

    return Promise.resolve(docker.listContainers({"latest": true}))
    .then( (containers) => {
      for (containerInfo of containers) {
        if (containerInfo.Labels["com.microsoft.product"]==="Microsoft SQL Server") {
          return containers[0].Id
        }
      }
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
  listContainers: () => {

    let list=[]
    if (api.sqlCatalog.ContainerInfos) {
      api.sqlCatalog.ContainerInfos.forEach((containerInfo) => {
        list.push(containerInfo)
      })
      if (list.length===0) {
        api.log('warn', `(listContainers) No Containers in Catalog`)
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
          api.log('log', folder)
          api.log('log', filter)
          files.forEach( function(file) {
            if (file.includes(filter)) {
              list.push(file)
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
  listImages: () => {

    let list=[]
    api.log('confirm', `(listImages) starting`)
    api.sqlCatalog.Images.forEach((image) => {
      list.push(image)
    })
    if (list.length===0) {
      api.log('warn', `(listImages) no Images in sqlCatalog`)
    }
    return list

  },
  loadCatalog: async () => {

    if (await api.isDocker()) {
      await api.catalogImages()
      await api.catalogContainers()
      await api.catalogInstance()
      if (api.sqlCatalog.Instance) {
        api.log('log', `(loadCatalog) CLI Target ${api.sqlCatalog.Instance}`.gray)
        sqldb.openPool()
      } else {
        api.log('warn', `(loadCatalog) SQL Server Target not found.
        List available with`+`'instance --all'`.italic+`
        Connect to a 'running' SQL instance using`+` 'instance -id <desired-container-id>'`.italic+`
        Define SQL start-up config using `+` 'config --app edit'`.italic+`
        Create new from a Docker image using `+` 'image --run'`.italic+`
        Get latest image from dockerhub.com using `+` 'image --pull'`.italic+`
          see`+` '--HELP'`.italic+` for more usage details`)
      }
    }

  },
  log: (mode, data) => {

    if (Object.keys(config.log).length===0) {
      if (mode==='error') {
        console.error(data)
        console.trace()
      } else {
        console.log(mode, data)
      }
    } else {
      switch (mode) {
        case ('confirm'):
          config.log.confirm(data)
          break
        case ('debug'):
          if (config.vantage.logLevel===10) {
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

  },
  mssqlConf: (containerId, confArgs) => {

    new Promise(function(resolve, reject) {
      if (api.sqlCatalog.ContainerInfos.has(containerId)) {
        let options = {
          Cmd: ['bash', '-c', `cd ${config.mssql.binPath}; mssql-conf ${confArgs||'-h'}`],
          AttachStdout: true,
          AttachStderr: true
        };
        let container=docker.getContainer(containerId)
        container.exec(options, function(err, exec) {
          if (err) return
          exec.start(function(err, stream) {
            if (err) return
            container.modem.demuxStream(stream, process.stdout, process.stderr)
            exec.inspect(function(err, data) {
              if (err) return
            })
          })
        })
      }
    })

  },
  mssqlFiles: (containerId, folder, filter) => {

    if (api.sqlCatalog.ContainerInfos.has(containerId)) {
      let options = {
        Cmd: ['bash', '-c', `ls -lb ${folder}| grep ${filter}`],
        AttachStdout: true,
        AttachStderr: true
      };
      let container=docker.getContainer(containerId)
      container.exec(options, function(err, exec) {
        if (err) return
        exec.start(function(err, stream) {
          if (err) return

          container.modem.demuxStream(stream, process.stdout, process.stderr)

          exec.inspect(function(err, data) {
            if (err) return
            api.log('debug', '(attach)')
            api.log('debug', data)
          })
        })
      })
    }

  },
  pullImage: () => {

    new Promise(function(resolve, reject) {
      docker.pull(config.docker.repo, function(err, stream) {
        docker.modem.followProgress(stream, onFinished)

        function onFinished(err, output) {
          if (err) {
            store.pulls.put(err)
            throw(err)
          }
          store.pulls.put(output)
          return resolve(output)
        }

      })
    })

  },
  restartContainer: (containerId) => {

    api.log('confirm', `restarting...`)
    //    return new Promise(function(resolve, reject) {
    if (api.sqlCatalog.ContainerInfos.has(containerId) && api.getContainerInfo(containerId).State==='running') {
      docker.getContainer(containerId).restart()
      .then( ()=> {
        api.log('debug', `(restartContainer) container ${containerId}`)
        if (api.sqlCatalog.Instance===containerId) {
          api.log('debug', '(restartContainer) reuse established connection pool')
        }
      })
      .catch( (err) => {
        api.log('debug', `(restartContainer) error container: ${containerId}`)
        api.log('error', err.message)
        api.log('debug', err.stack)
      })
    } else {
      api.log('warn', 'sqlpal restarts only cataloged and running SQL Server containers')
    }
    //    })

  },
  runImage: (imageId) => {

    return new Promise(function(resolve, reject) {
      if (api.sqlCatalog.Instance && api.getContainerInfo().Mounts[0].Destination===config.docker.sqlVolume) {
        api.log('error', `(run) a container is already active in the host volume '${config.docker.sqlVolume}'`)
        return
      }
      if (!imageId) {
        api.log('error', '(run) imageId is required')
        return
      }
      let args = [
        `-e`, `ACCEPT_EULA=${config.mssql.acceptEULA}`,
        `-e`, `SA_PASSWORD=${config.mssql.sa.password}`,
        `-p`, `${config.docker.hostPort}:${config.docker.sqlPort}`,
        `-v`, `${config.docker.sqlVolume}:${config.docker.sqlVolume}`,
        `-d`, `${imageId}`
      ]
      docker.run(imageId, args, process.stdout).then(function(container) {
        api.log('log', container.output)
        return resolve(sqlContainers.set(container.Id, container))
      }).catch(function(err) {
        api.log('warn', `error running image ${imageId}`)
        api.log('error', err.message)
        api.log('debug', err.stack)
      })
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
  startContainer: async (containerId) => {

    return new Promise(function(resolve, reject) {
      try{
        if (containerId && api.sqlCatalog.ContainerInfos.has(containerId)) {
          let container = docker.getContainer(containerId)
          if (api.sqlCatalog.ContainerInfos.get(containerId).State!='running') {
            container.start()
            api.log('log', `started instance ${container.id}`)
            resolve()
          }
        }
      }
      catch (err){
        api.log('warn', `(startContainer) error container: ${containerId}`)
        reject(err)
      }
    })

  },
  stopContainer: async (containerId) => {

    return new Promise(function(resolve, reject) {
      try {
        if (containerId && api.sqlCatalog.ContainerInfos.has(containerId)) {
          let container = docker.getContainer(containerId)
          if (container) {
            api.log('debug', `Stopping SQL Server container ${containerId}`)
            if (api.sqlCatalog.Instance===container.id) {
              sqldb.closePool()
            }
            container.stop()
            api.log('log', `stopped instance ${container.id}`)
            resolve()
          }
        }
      }
      catch (err) {
        reject(err)
      }
    })


  },
  startSQLPad: () => {

    if (config.sqlpad.sqlpad) {
      config.sqlpad.sqlpad.kill()
    }
    const sqlpadArgs = []
    if (config.logLevel===10) {
      config.sqlpad.debug=true
      config.logLevel===10
    }

    Object.keys(config.sqlpad).forEach( (key) => {
      if (config.sqlpad[key]) {
        sqlpadArgs.push( key.length==1? `-${key}`: `--${key}` )
        sqlpadArgs.push( config.sqlpad[key])
      }
    })
    sqlpad = childProcess.spawn('sqlpad', sqlpadArgs)
    sqlpad.on('error',  (data) => {
      api.log('warn', `[sqlpad]`.cyan.italic + `unable to start sqlpad server`.gray)
      api.log('error', err)
    })
    sqlpad.stdout.on('data', (data) => {
      if (/Welcome/.test(data)) {
        api.log('log', `${data}`.cyan.italic )
      } else {
        if (config.sqlpad.debug) {
          api.log('debug', `[sqlpad] `.cyan.italic + `${data}`.gray)
        }
      }
    })
    sqlpad.stderr.on('data', (data) => {
      api.log('log', `[sqlpad] `.cyan.italic + `error `.magenta.bgWhite + `${data}`.red)
    })
    sqlpad.on('exit', (code) => {
      api.log('log', config.log)
      api.log('warn', `[sqlpad] `.cyan.italic + `server exited with code ${code}`)
    })
    config.sqlpad.sqlpad=sqlpad

  },
  tailLog: (containerId) => {

    api.log('debug', `(spawn) docker logs --follow ${containerId} --tail 0`)
    config.tail[containerId] = childProcess.spawn('docker', [`logs`, `--follow`, `${containerId}`, `--tail`, 0])
    config.tail[containerId].stdout.on('data', (data) => {
      api.log('log', `tail `.cyan.italic + `${data}`.gray)
    })
    config.tail[containerId].stderr.on('data', (data) => {
      api.log('log', `tail error `.magenta.bgWhite.italic + `${data}`.red)
    })
    config.tail[containerId].on('exit', (code) => {
      api.log('warn', `tail of container ${containerId} SQL Server errorlog has ended with code ${code}`)
    })

  }

}
