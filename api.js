////NPM
const Docker = require('dockerode')
const colors = require('colors')
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

  bandAid: `\n\t\t\t l Q _ \n\t\t\t   |   \n\t\t\t  / \\  \n`.green,
  catalogImages: async () => {

    return Promise.resolve(docker.listImages())
    .then( (images) => { // Id keyed map of images
      for (let image of images) {
        if (image.RepoDigests[0].startsWith(`${config.docker.repo}@`)) {
          api.log('log', `(catalogImages) ${image.Id}`.cyan+` (${image.Labels["com.microsoft.version"]})`)
          api.sqlCatalog.Images.set(image.Id, image)
        }
      }
    })

  },
  catalogContainers: async (imageId) => {

    return new Promise(function(resolve, reject) {
      try {
        return docker.listContainers({
          "all": true,
          "size": true,
          "filters": { "ancestor": [`${imageId}`] }
        })
        .then( (containers) => {
          containers.forEach( (info) => {
            let status = info.State!='running'? info.Status.red: info.Status.green
            api.log('log', `(catalogContainers) ${info.Id} (${info.Labels["com.microsoft.version"]}) ${status}`)
            api.sqlCatalog.ContainerInfos.set(info.Id, info)
          })
        })
        .then( () => {
          resolve(true)
        })
      }
      catch (err) {
        reject(err)
      }
    })

  },
  catalogInstance: (containerId) => {

    api.sqlCatalog.Instance = containerId || api.sqlCatalog.Instance
    if (api.sqlCatalog.Instance) {
      api.log('log', `(catalogInstance) CLI Targeting SQL Instance ${api.sqlCatalog.Instance}`.gray)
    }

  },
  checkNPM: async (depth) => {

    return new Promise(function(resolve, reject) {
      if (typeof depth=='boolean') depth=0
      childProcess.exec(`npm outdated`, {}, (err, result) => {
        if (err) reject(err)
        resolve(result|| 'up to date')
      })
    })

  },
  commandAid: (cmds) => {

    let admin=[], builtin=[], cli=[], docker=[], load=[], inject=[], terminate=[]
    cmds.forEach( (cmd) => {
      switch(true) {
        case(['HELP', 'EXIT', 'WHO', 'VORPAL', 'REPL', 'LOGLEVEL'].includes(cmd._name.toUpperCase())):
          builtin.push(`${cmd._name.toUpperCase().red}\t\t${cmd._description}`)
          break
        case(['QUERY', 'SCRIPT'].includes(cmd._name.toUpperCase())):
          inject.push(`${cmd._name.toUpperCase().magenta}\t\t${cmd._description}`)
          break
        case(['GO', 'RUN', 'TEST', 'SQLCMD'].includes(cmd._name.toUpperCase())):
          terminate.push(`${cmd._name.toUpperCase().green}\t\t${cmd._description}`)
          break
        case(['BCP', 'BULK'].includes(cmd._name.toUpperCase())):
          load.push(`${cmd._name.toUpperCase().yellow}\t\t${cmd._description}`)
          break
        case(['ENGINE', 'IMAGE', `INSTANCE`].includes(cmd._name.toUpperCase())):
          docker.push(`${cmd._name.toUpperCase().blue}\t\t${cmd._description}`)
          break
        case(['CACHE', 'ABOUT'].includes(cmd._name.toUpperCase())):
          cli.push(`${cmd._name.toUpperCase()}\t\t${cmd._description}`)
          break
        default:
          if (cmd._name) {
            admin.push(`${cmd._name.toUpperCase().cyan}\t\t${cmd._description}`)
          }
          break

      }
    })
    return [
      `Entered lines not beginning with a `+`COMMAND`.rainbow+` - in caps below but caps not req'd - are buffered into a T-SQL batch.`,
      `  When a `+`terminating command`.italic +` starts next line, the tSQL batch executes. Successful execution archives buffered T-SQL.`,
      `\t--HELP`.rainbow + `\t\tThis text ('HELP' and 'ABOUT -c' commands below provide different listings of the CLI commands)`,
      `  `+`sqlpal`.rainbow.underline+` CLI Administration`.gray.underline+`- Client side components and settings `.gray,
      `\t${cli.join('\n\t')}`,
      `  `+`Bulk Load Commands`.gray.underline+`- Move external Data into the target SQL Server`.gray,
      `\t${load.join('\n\t')}`,
      `  `+`Batch Cache Injection Commands`.gray.underline+`- Overwrite the Batch Cache buffer with a previously stored query`.gray,
      `\t${inject.join('\n\t')}`,
      `  `+`Batch Cache Termination Commands`.gray.underline+` Compile Batch Cache buffer to T-SQL & submit to Target SQL Server\'s Query Engine`.gray,
      `\t${terminate.join('\n\t')}`,
      `\tuse 'cache --new' (or w/cache alias '? -n') to empty the Batch Cache without submitting to SQL Server`.gray,
      `  `+`Docker Administration Commands`.gray.underline+``,
      `\t${docker.join('\n\t')}`,
      `  `+`SQL Server for Linux Adminstration Commands`.gray.underline+``,
      `\t${admin.join('\n\t')}`,
      `  `+`Vorpal Built-ins`.gray.underline,
      `\t${builtin.join('\n\t')}`,
      `\n\tType `.gray+`--help`.italic.inverse+` for Application Usage Info or `.gray+`help`.italic.inverse+` for CLI command listing\n
       Use `.gray+`help <CLI-command>`.italic.inverse+` or `.gray+`<CLI-command> --help`.italic.inverse+` for that CLI command\'s Usage Info\n
       Command args are represented as [optional] or <required>,
       and documented as either `.gray+`the word if a literal`.italic.gray+
      ` or `.gray+`hyphenated-if-user-input`.italic.gray].join(`\n`)

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
          with a text editor of choice. Either GNU Emacs or Github.com's Atom-beta
          work for me. If your editor is in your $PATH, you can add as .editor in
          config.json.
          If '${textFile}' is modified, restart the app after you save the file`)
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
  getProcesses: async (containerId) => {

    return new Promise(async function(resolve, reject) {
      try{
        containerId=containerId || api.sqlCatalog.Instance
        if (containerId && api.sqlCatalog.ContainerInfos.has(containerId)) {
          let top = {"Processes":[]}
          let container = docker.getContainer(containerId)
          if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
            top=await container.top('-x') //no other flags seem to work????
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
  latestContainers: async (number=3) => {

    return Promise.resolve(docker.listContainers({"last": number}))
    .then( (containers) => {
      let latest=[]
      for (containerInfo of containers) {
        if (containerInfo.Labels["com.microsoft.product"]==="Microsoft SQL Server") {
          latest.push(containerInfo)
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
  listContainers: () => {

    let list=[]
    if (api.sqlCatalog.ContainerInfos.size>0) {
      for (let info of api.sqlCatalog.ContainerInfos) {
        list.push(info)
      }
    } else {
      api.log('warn', `(listContainers) No Containers in Catalog`)
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
          files.forEach( function(fileName) {
            if (fileName.includes(filter)) {
              list.push(fileName+'\n')
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
        if (filter) {
          list.push(image)
        }
      }
    } else {
      api.log('warn', `(listContainers) No Images in Catalog`)
    }
    return list

  },
  loadCatalog: async (instanceId) => {

    if (await api.isDocker()) {
      api.sqlCatalog.Images = new Map()
      api.sqlCatalog.ContainerInfos = new Map()
      api.sqlCatalog.Instance = undefined
      api.catalogImages()
      .then( async () => {
        for (let image of api.sqlCatalog.Images) {
          await api.catalogContainers(image[0])
        }
      })
      .then( async ()=> {
        if (!instanceId) {
          // if only one, use it
          if (api.sqlCatalog.ContainerInfos.size===1) {
            for (let info of api.sqlCatalog.ContainerInfos) {
              instanceId=info[0]
            }
          } else {
            // if only one running, use it
            let running=[]
            for (let info of api.sqlCatalog.ContainerInfos) {
              if (info.State==='running') {
                running.push(info[0])
              }
            }
            if (running.length===1) {
              instanceId=running[0]
            }
          }
        }
        if (api.sqlCatalog.ContainerInfos.has(instanceId)) {
          api.catalogInstance(instanceId)
        }
        if (api.sqlCatalog.Instance) {
          await sqldb.openPool()
          api.log('log', `(loadCatalog) CLI connect Target ${api.sqlCatalog.Instance}`.gray)
        } else {
          api.log('warn', `(loadCatalog) SQL Server Target not set:\n
          `.red+`image    --pull`.padEnd(40).italic.inverse+` to get '${config.docker.repo}:latest' from dockerhub
          `+`image    --run    [image-id]`.padEnd(40).italic.inverse +` to create & run a new Instance from a local image
          `+`instance --target [container-id]`.padEnd(40).italic.inverse+` to target CLI at a Hosted SQL Container
          `+`cache    --map         (alias: '? -m')`.padEnd(40).italic.inverse+` to see Hosted SQL for Linux on Docker Catalog
          `+`config   --app edit`.padEnd(40).italic.inverse +` to configure `+`sqlpal`.rainbow+`\n
          \t`+`--help`.italic.inverse+` for Application Usage Info or `+`help`.italic.inverse+` for CLI command listing and\n
          \t`+`help <CLI-command>`.italic.inverse+` or `+`<CLI-command> --help`.italic.inverse+` for that CLI command\'s Usage Info\n`)
        }
      })
    }

  },
  log: (mode, data) => {

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

  },
  mssqlConf: (containerId, confArgs) => {

    // mssql-conf not compiled in the .3006 RTM image?
    new Promise(function(resolve, reject) {
api.log('confirm', `container ${containerId} confArgs ${confArgs}`)
      if (api.sqlCatalog.ContainerInfos.has(containerId)) {
        let options = {
          Cmd: ['bin/bash', '-c', `cd ${config.odbc.binPath}; mssql-conf ${confArgs}`],
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
  pullImage: async () => {

    new Promise(function(resolve, reject) {
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
  restartContainer: async (id=api.sqlCatalog.Instance) => {

    new Promise(function(resolve, reject) {
      try {
        api.log('confirm', `(restartContainer) ${id===sqldb.target()?'target':'container'}: ${id}`)
        let target = (sqldb.target())
        // if (target) {
        //   sqldb.closePool()
        // }
        let container=docker.getContainer(id)
        return container.restart()
        .then( async (container) => { // old
          if (id===sqldb.target()) {
            await api.tailLog(container)
          }
        })
        .then( async () => {
          await api.loadCatalog()
        })
        .then( async () => {
          if (id===target) { // new
            api.catalogInstance(id)
            await sqldb.connect()
          }
        })
      }
      catch(err) {
        reject(err)
      }
    })

  },
  removeContainer: async (containerId) => {

    return new Promise( async function(resolve, reject) {
      try {
        if (api.sqlCatalog.ContainerInfos.has(containerId)) {
          docker.getContainer(containerId).remove()
          .then( () => {
            resolve(api.loadCatalog())
          })
          .catch(err => {
            reject(err)
          })
        }
      }
      catch (err) {
        reject(err)
      }
    })

  },
  runImage: async (imageId) => {

    return new Promise( async function(resolve, reject) {
      try {
        getPort(config.docker.sqlPort)
        .then( (hostPort) => {
          return docker.createContainer({
            Image: imageId,
            Env: [
              `ACCEPT_EULA=${config.mssql.acceptEULA}`,
              `MSSQL_SA_PASSWORD=${config.mssql.pool.password}`
            ],
            HostConfig: {PortBindings: {"1433/tcp": [{HostPort: `${hostPort}`}]}}
          })
        })
        .then( (container) => {
          resolve(container.start())
        })
      }
      catch (err) {
        reject(err)
      }
    })
  },
  runImageold: async (imageId) => {

    return new Promise( async function(resolve, reject) {
      try {
        api.log('confirm', `(runImage) imageId ${imageId}`)
        let port=getPort(config.docker.sqlPort)
        let args = [ `docker`, `run`,
          `-e`, `"ACCEPT_EULA=${config.mssql.acceptEULA}"`,
          `-e`, `"MSSQL_SA_PASSWORD=${config.mssql.pool.password}"`,
          `-p`, `${port}:${config.docker.sqlPort}`,
          `-d`, api.sqlCatalog.Images.get(imageId).RepoTags[0]
        ]
        if (config.docker.bindMount) {
          args.push(`-v`)
          args.push(`${config.docker.hostVolume}:${config.docker.sqlPath}`)
        }
        args.push(`-d`)
        args.push(imageId)

        childProcess.spawn(`sudo`, args, {
          stdio: 'inherit',
          shell: false
        }, (err) => {
          if (err) reject(err)
        })
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
  startContainer: async (id=api.sqlCatalog.Instance) => {

    // this is really startTarget
    // startContainer proper should never tail or openPool, just restart and then reload
    api.log('confirm', `(startContainer) ${id}`)
    return Promise.resolve(docker.getContainer(id))
    .then( (container) => {
      if (container && api.sqlCatalog.ContainerInfos.has(id)) {
        if (api.sqlCatalog.ContainerInfos.get(id).State!='running') {
          return container.start()
        }
      }
    })
    .then( (container) => {
      api.tailLog(container)
    })
    .then( () => {
      api.loadCatalog()
    })
    .then( () => {
      if (id===api.sqlCatalog.Instance) {
        api.log('confirm', `(startContainer) opening pool`)
        sqldb.openPool()
      }
    })

  },
  stopContainer: async (containerId) => {

    api.log('debug', `Stopping SQL Server container ${containerId}`)
    return new Promise(function(resolve, reject) {
      try {
        containerId=containerId || api.sqlCatalog.Instance
        if (containerId && api.sqlCatalog.ContainerInfos.has(containerId)) {
          let container = docker.getContainer(containerId)
          if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
            api.log('debug', `Stopping SQL Server container ${containerId}`)
            if (api.sqlCatalog.Instance===container.id) {
              sqldb.closePool()
            }
            container.stop()
            .then( async () => {
              await api.loadCatalog()
            })
            .then( () => {
              resolve(api.log('log', `stopped instance ${container.id}`))
            })
          }
        }
      }
      catch (err) {
        reject(err)
      }
    })

  },
  startSQLPad: () => {
    pem.createCertificate(config.pem, function(err, keys){
      // TODO!!! self-cert w/out the file system ifucan?
      fs.writeFileSync(config.sqlpad[`key-path`], keys.serviceKey)
      fs.writeFileSync(config.sqlpad[`cert-path`], keys.certificate)

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
          api.log('info', `For best results, use sqlpad from a browser running the V8 javascript engine (Chromium or Chrome)`.cyan.italic )
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
    })

  },
  tailLog: async (container) => {

    new Promise(function(resolve, reject) {
      // return Promise.resolve(docker.getContainer(id)) // passing id to promise returns 'logger is not defined'
      // .then( (container) => {
      if (container) {
        let logStream = new stream.PassThrough()
        // copy-paste strikes again, you'll get the full log output twice if this handler runs
        // but the right pace to watch for 'Recovery Complete' instead of screen dump
        logStream.on('data', function(chunk){
          api.log('log', chunk.toString('utf8'))
          if (/SQL Server is now ready for client connections/.test(chunk.toString('utf8'))) {
            api.log('log', chunk.toString('utf8'))
            sqldb.openPool()
            logStream.emit('end', 'SQL Server is now ready for client connections')
          }

        })
        // and now call stack wants to know wtf is a logger may just mean I need yet another reboot since I started using this
        container.logs({
            tail: 20,
            follow: true,
            stdout: true,
            stderr: true
          }, function(err, stream){
            if(err) {
              logger.error(err.message)
              reject(err)
            }
            container.modem.demuxStream(stream, logStream, logStream)
            stream.on('end', function(){
              resolve(logStream.end('...log follow has ended'))
            });
            setTimeout(function() {
              resolve(stream.destroy())
            }, 3000)
        })
      }
    })
  }

}
