//// NPM
const chalk = require('chalk')
const Docker = require('dockerode')
const getPort = require('get-port')
const { prompt } = require('inquirer')
//// core
const path = require('path')
const { finished, PassThrough } = require('stream')
//// local  

//TODO ??? atomics for map tests to enable updates to the map instead of always re-intern()

// sees em when commented out, fails when not
// ??? similar thing happens in viewer ???

//const api = require('../lib/api')
const { format, log } = require('../lib/log') // format useful for debug obj output
const { lines, pools, pulls } = require('../lib/store')
const { ucons } = require('../lib/viewer')

const { name } = require('../package.json')
const config = require('../config/config.json')

let docker = new Docker()
let sqlCatalog = {}

module.exports = catalog = {
  closeInstance: async containerId => {
    return Promise.resolve(catalog.sql.Pools.get(containerId).close())
    .then( () => {
      catalog.sql.Pools.delete(containerId)
    })
    .catch( err => log('error', `(closeInstance) failed\n${err}`))  
  },
  cmdAttached: async (
    containerId, 
    command, 
    options = {
      "AttachStdin": true,
      "AttachStdout": true,
      "AttachStderr": true,
      "Tty": true,
      "Cmd": ['bash'],
      "Env": [],
      "Privileged": false,
      "User": process.user,
      "WorkingDir": config.cli.odbc.path
    }) => {
    new Promise( async (resolve, reject) => {
      try {
        if ((await catalog.inspectContainer(containerId)).State.Status==='running') {
          return docker.getContainer(containerId)
          .then( container => {
            if (command) options.Cmd.push(command)
            container.exec(options, (err, exec) => {  
              if (err) reject(err)
              exec.start( (err, stream) => {
                if (err) reject(err)
                container.modem.demuxStream(stream, process.stdout, process.stderr)
              })
              resolve(true)
            })
          })
          .catch( err => log('error', `(cmdAttached) failure\n${err}`))
        }  
      }
      catch(err) {
        reject(err)
      }
    })
  },
  chooseImageId: async (message='SQL Image', filterfn) => { 
    return new Promise( async (resolve, reject) => {
      let choices = []
      for (let [id, image] of catalog.sql.Images) {
        choices.push({
          "name": `${id}  (v.${image.Labels["com.microsoft.version"]})  ${image.RepoTags}`, 
          "short": id, 
          "value": image.Id
        })
      }
      if (choices.length===0) resolve(false)
      return prompt([{
        type: 'list',
        name: 'imageId',
        message: message + ' ',
        choices: choices,
        filter: filterfn,
        default: await catalog.latestImageId() 
      }])
      .then( answer => {
        resolve(answer.imageId)
      })
      .catch( err => log('error', `(choose) ${err}`))  
    })    
  },
  chooseInstanceId: async (status='all', message="SQL Instance", dft=catalog.sql.Instance, filter) => {
    return new Promise( async (resolve, reject) => {
      let choices = [], inspect
      for (let [id, info] of catalog.sql.ContainerInfos) {
        inspect = await catalog.inspectContainer(id)
        if (status==='all' || (status==='up' && inspect.State.Running) || (status!=='up' && !inspect.State.Running)) {
          choices.push({
            "name": `${id}  v.${info.Labels["com.microsoft.version"].padEnd(14)}  ${info.Names[0].padEnd(20)}  ${inspect.State.Status}`, 
            "short": inspect.Id.substring(0,12), // inspect.Config.Hostname, 
            "value": inspect.Id           
          })
        }  
      }  
      if (choices.length===0) resolve(false)
      prompt([{
        type: 'list',
        name: 'instanceId',
        message: message + ' ',
        choices: choices,
        filter: filter,
        default: dft 
      }])
      .then( answer => {
        resolve(`${answer.instanceId}`.substring(0, 12))
      })
      .catch( err => log('error', `(choose) ${err}`))  
    })      
  },
  choosePoolId: async (message="CLI Connection Pool SQL Container", filter) => {
    return new Promise( async (resolve, reject) => {
      let choices = []
      for (let [id, pool] of catalog.sql.Pools) {
        choices.push({ 
          "name": `${id} using '${pool.pool.database}' as '${pool.pool.user}' on port ${pool.pool.port}`, 
          "short": id, 
          "value": id
        })
      }
      if (choices.length===0) resolve(false)
      return prompt([{
        type: 'list',
        name: 'poolId',
        message: message + ' ',
        choices: choices,
        filter: filter
      }])
      .then( answer => {
        resolve(answer.poolIdId)
      })
      .catch( err => log('error', `(choosePoolId) ${err}`))  
    })    
  },
  getAddress: containerId => {
    let addressMap=new Map()
    if (containerId && catalog.sql.ContainerInfos.has(containerId)) {
      let info = catalog.sql.ContainerInfos.get(containerId)
      if (info.State==='running') {
        addressMap.set(containerId, {  
          bridge: `${info.NetworkSettings.Networks.bridge.IPAddress}:${info.Ports[0].PrivatePort}`,
          localhost: `${info.NetworkSettings.Networks.bridge.Gateway}:${info.Ports[0].PublicPort}`
        })
      }  
    } else { // container not found or not specified
      if (catalog.sql.ContainerInfos.size>0) {
        let id, info
        for ([id, info] of catalog.sql.ContainerInfos) {
          if (info.State==='running') {
            addressMap.set(`${id}  ${info.Names[0]}`, {  
              bridge: `${info.NetworkSettings.Networks.bridge.IPAddress}:${info.Ports[0].PrivatePort}`,
              port: `${info.Ports[0].PublicPort}`
            })
          }
        }
      }
    }
    return addressMap
  },
  getEnvVariable: async (containerId, varName) => {
    return new Promise(async (resolve, reject) => {
      try {
        let options = {
          Cmd: [config.cli.bash.path, '-c', `echo ${varName}`],
          AttachStdout: true,
          AttachStderr: true
        }
        let container = await docker.getContainer(containerId) 
        container.exec(options, (err, exe) => {
          if (err) reject(err)
          exe.start( (err, stream) => { // stream is htp socket
            if (err) reject(err)
            stream.on('data', data => {
              resolve(data.toString().replace(/[\x00-\x1F\x7F-\x9F]/g, ""))
            })
            stream.on('error', err => {
              reject(err)
            })
          })
        })
      }
      catch (err) {
        resolve(log('error', `(getEnvVariables) container: ${containerId}\n${err.stack}`))
      }
    })
  },
  getImage: async imageId => {
    return new Promise( async (resolve, reject) => {
      try {
        if (!imageId) {
          if (catalog.sql.Images.size===0) resolve(log('warn', `No images in catalog, try 'image --pull'`))
          else if (catalog.sql.Images.size===1) resolve(catalog.sql.Images.get(catalog.sql.Images.keys().next()))
          else if (catalog.sql.Instance) resolve(catalog.sql.Images.get(await catalog.getInstanceInfo(catalog.sql.Instance).ImageID))
          else resolve(catalog.sql.Images.get(await catalog.latestImageId()))
        } else resolve(catalog.sql.Images.get(imageId))
      }
      catch(err) {
        log('error', `(getImage) imageId: ${imageId}\n${err.stack}`)
        resolve(false)
      }
    })
  },
  getInstanceInfo: () => {
    return catalog.chooseInstanceId('all')
    .then( (containerId) => {
      return catalog.sql.ContainerInfos.get(containerId)
    })
    .catch( (err) => log('error', err))
  },
  getPorts: containerId => {
    return new Promise(async (resolve, reject) => {
      try {
        (await docker.getContainer(containerId)).inspect(function (err, data) {
          if (err) reject(err)
          resolve(data.NetworkSettings.Ports)
        })  
      }
      catch (err) {
        reject(log('error', `(getPorts) container: ${containerId}\n${err.stack}`))
      }
    })
  },
  getProcesses: async (containerId) => {
    if (!containerId) containerId = (await catalog.chooseInstanceId('up')).substring(0,12)
    if (catalog.sql.ContainerInfos.get(containerId).State==='running') {
      return await docker.getContainer(containerId).top("-x")
    } else {
      log('catalog', `Container ${containerId} is not running`)
    }
  },
  inspectContainer: async (containerId) => {    
    return new Promise(async (resolve, reject) => {
      try {
        if (!containerId) containerId = await catalog.chooseInstanceId('all')
        docker.getContainer(containerId).inspect(function (err, data) {
          if (err) reject(err)
          resolve(data)
        })
      }
      catch (err) {
        reject(log('error', `(inspectContainer) container: ${containerId}\n${err.stack}`))
      }
    })
  },
  intern: async containerId => {
    return new Promise( async (resolve, reject) => {
      try {
        // obj of maps as private runtime catalog of local MS-SQL images, containers and connections
        if (await catalog.isHost()) { 
          let instanceId = containerId? `${containerId}`.substring(0, 12): await pools.getLastInstanceId()
          catalog.sql.Images = new Map()
          catalog.sql.ContainerInfos = new Map()
          catalog.sql.Instance = instanceId
          catalog.sql.Pools = catalog.sql.Pools || new Map() 
          log('progress', `\n${ucons.get('catalog')}  `)
          if (await catalog.internImages()) {
            if (await catalog.internContainers()) {
              if (!catalog.sql.instanceId) {
                if (catalog.sql.ContainerInfos.size===1) {
                  catalog.sql.instanceId=catalog.sql.ContainerInfos.keys().next()
                } else if (catalog.listInstances('running').length===1) {
                  catalog.sql.instanceId = catalog.listInstances('running')[0]                  
                }
              }
            }
            log('progress', `\n`)            
            if (catalog.sql.ContainerInfos.has(instanceId)) {
              await catalog.internInstance(instanceId)
              if (instanceId===catalog.sql.Instance) { 
                if (catalog.sql.ContainerInfos.get(instanceId).State==='running') {
                  await api.openInstance(instanceId)
                } else {        
                  log('target', chalk`{yellowBright Target SQL Server Container not running}: ${instanceId}`)
                  if (!(await lines.getLast()).line.includes('stop')) {
                    if (await api.confirm(`Start Target Container now?`)) {
                      await catalog.startInstance(instanceId)
                    }
                  }
                }  
              } else {
                log('target', chalk`{redBright Target SQL Server for CLI's TSQL queries not found}: ${instanceId}`)
                if (await api.confirm(`Select a Target SQL Container now?`)) {
                  await catalog.internInstance(await catalog.chooseInstanceId('all'))
                }
            }
            } else {
              if (catalog.sql.ContainerInfos.size>0) {
                if (!catalog.sql.instanceId) {
                  log('target', chalk`{yellowBright No Target set for CLI's TSQL queries found}`)
                  if (await api.confirm(`Select a Target SQL Container now?`)) {
                    await catalog.internInstance(await catalog.chooseInstanceId('all'))
                  }
                } else {
                  log('target', chalk`{redBright Target SQL Server for CLI TSQL queries not found}: ${instanceId}`)
                  if (await api.confirm(`Select a Target SQL Container now?`)) {
                    await catalog.internInstance(await catalog.chooseInstanceId('all'))
                  }
                }
              } else {
                log('catalog', chalk`{yellowBright  No Local SQL Containers found}`)
                if (await api.confirm(`Create a new SQL Container now?`)) {
                  await catalog.runImage()
                }
              }  
            }
          } else {
            log('catalog', chalk`{yellowBright  No Local SQL Images found}`)
            if (await api.confirm(`Pull the latest SQL Image now?`)) {
              await catalog.pullImage()
            }
          }    
          resolve(true)
        } 
        resolve(false)
      }  
      catch(err) {
        log('catalog', `(intern) failed\n${err.stack}`)
        resolve(false)
      }
    })  
  },
  internContainers: async () => {
    try {
      for (let [imageId] of catalog.sql.Images) {
        let containers = await docker.listContainers({
          "all": true,
          "size": true,
          "filters": { "ancestor": [`${imageId}`] }
        })
        for (let info of containers)  {
          if (info.State=='running') {
            log('progress', ucons.get('containerRunning'))
          } else {
            log('progress', ucons.get('containerIdle'))
          }
          catalog.sql.ContainerInfos.set(info.Id.substring(0,12), info)
        }
      }
      if (catalog.sql.Containers && catalog.sql.Containers.size===0) {
        return false
      } else {
        return true
      }
  }
    catch(err) {
      log('progress', '\n')
      log('catalog', `(InternContainers) failed\n${err.stack}`)
      return false
    }
  },
  internImages: async () => {
    // will be first place to fail at startup if user not in docker group or tls is broken
    // sudo usermod -aG docker $USER 
    try {
      let images= await docker.listImages()
      let repo= config.mssql.repo.path
      for (let image of images) { 
        if (image.RepoDigests.find( (digest) => { return repo===digest.substring(0, digest.indexOf('@'))})) {
          let shortid = image.Id.includes(':')? image.Id.substring(image.Id.indexOf(':')+1, image.Id.indexOf(':')+1+12): image.Id.substring(0, 12)
          catalog.sql.Images.set(shortid, image) 
          log('progress', ucons.get('image'))
        }       
      }
      if (catalog.sql.Images.size===0) {
        return false
      } else {
        log('progress', ` `)
        return true
      }
    }  
    catch(err) {
      log('progress', '\n')
      if (err.code==='EACCES') {
        log('catalog', chalk`(internImages) {red 'EACESS': user '${process.user}' not authorized}`)
      } else {
        log('catalog', `(InternImages) failed\n${err.stack}`)
      }
      return false
    }
  },
  internInstance: (instanceId=catalog.sql.Instance) => {
    try {
      if (catalog.sql.ContainerInfos.has(instanceId)) {
        catalog.sql.Instance = instanceId.substring(0,12)
        return true
      } else {
        return false
      }
    }
    catch(err) {
      log('catalog', chalk`(internInstance) {red failed, container ${instanceId}}\n${err.stack}`)
      return false
    }
  },
  internPool: async (instanceId=catalog.sql.Instance, config) => {
    try {
      await pools.update(instanceId, config)
      catalog.sql.Pools.set(instanceId, await pools.get(instanceId))
      return true
    }
    catch(err) {
      log('catalog', chalk`(internPool) {red failed, container ${instanceId}}\n${err.stack}`)
      return false
    }
  },
  isHost: async () => {
    return new Promise( async (resolve, reject) => {
      try {
        if (typeof docker==='undefined') {
          resolve(false) 
        } else {
          try {
            if (!(await api.shell(`ps -e|grep dockerd`))) {
              log('catalog', chalk`(isHost) No daemon process {rgb(127,255,0) check engine}`)
              resolve(false)
            }           
            else {
              await docker.ping()          
              resolve(true)
            }  
          }
          catch(e) {
            log('error', chalk`(isHost) {yellowBright.italic Docker.ping failed} reason: ${e.code? e.code:
              `${e.message}`}`)
            resolve(false)
          }
        } 
      }
      catch(err) {
        log('error', chalk`(isHost) {yellowBright.italic Failed to confirm Docker Engine}\n${err.stack}`)
        resolve(false)
      }
    })
  },
  latestInstances: async (limit=3) => {
    return Promise.resolve(docker.listContainers({"last": limit}))
      .then( (containers) => {
        let latest=[]  
        // have done nothing to assure these last! assumes fifo based on nothing
        for (let containerInfo of containers) {
          if (containerInfo.Labels["com.microsoft.product"]==="Microsoft SQL Server") {
            latest.push({Id: containerInfo.Id, $$DATE: containerInfo.Created})
          }
        }
        resolve(latest)
      }).catch( err => {
        log('error', `(latestInstances) ${err}`)
        resolve(false)
      })
  },
  latestImageId: async () => {
    for (let image of await docker.listImages()) {
      if (image.RepoTags) {
        for (let tag of image.RepoTags) {
          if (tag===`${config.mssql.repo.path}:${config.mssql.repo.tag}`) {
            return image.id
          }
        }
      }
    }
  },
  listInstances: state => { // ['up', 'idle', 'all']
    let list=[]
    let id=''
    let info={}
    if (catalog.sql.ContainerInfos.size>0) {
      for (let [id, info] of catalog.sql.ContainerInfos) {
        if (!state || state===info.State) {
            list.push(info)
        }
      }
    }
    return list
  },
  listInstanceIds: (status) => { // ['up', 'idle', 'all']
    let list=[]
    let id=''
    let info={}
    if (catalog.sql.ContainerInfos && catalog.sql.ContainerInfos.size>0) {
      for (let [id, info] of catalog.sql.ContainerInfos) {
        if (['up', 'all'].includes(status) && info.State==='running') {
          list.push(id)
        } else if (['idle', 'all'].includes(status) && info.State!=='running') {
          list.push(id)
        } 
      }
    }
    return list
  },
  listInstancesSummary: async () => {
    log('log', chalk.inverse(`Containers Created`.padEnd(26).padStart(30)))
    for (let info of catalog.sql.ContainerInfos) {
      id = info[0]===catalog.sql.Instance? chalk.cyan.bold(`${info[0]}`): info[0] 
      if (info[1].State!=='running') { 
        status = chalk`{red stopped} ${(await catalog.inspectContainer(info[0])).State.FinishedAt}`
      } else {
        status = chalk`{green started} ${(await catalog.inspectContainer(info[0])).State.StartedAt}`
      }  
      log('log', `${id}  v.${info[1].Labels["com.microsoft.version"].padEnd(14)}  ${info[1].Names[0].padEnd(20)}  ${status}`) 
    }
  },
  listImages: imageId => {
    let list=[]
    if (catalog.sql.Images.size>0) {
      for (let [id, image] of catalog.sql.Images) {
        if (!imageId || imageId===id) {
          list.push(image)
        }
      }
    }
    return list
  },
  listImagesSummary: async () => {
    log('log', chalk.inverse(`Images Pulled`.padEnd(26).padStart(30)))
    for (let [id, image] of catalog.sql.Images) {
      id===catalog.sql.Instance && (await catalog.getInstanceInfo(id)).ImageID.includes(id)? chalk.cyan.bold(`${id}`): id 
      log('log', `${id}  (v.${image.Labels["com.microsoft.version"]})  ${image.RepoTags? image.RepoTags[0]: ""}`)
    }
  },      
  listPoolsSummary: () => {
    log('log', chalk.inverse(`Pools Opened`.padEnd(26).padStart(30)))
    for (let [poolId, pool] of catalog.sql.Pools) {
      id = poolId===catalog.sql.Instance? chalk.cyan.bold(`${poolId}`): poolId 
      log('log', `${id} using '${pool.pool.database}' as '${pool.pool.user}' on port ${pool.pool.port}`)
    }
  },
  pullImage: async () => {
    // ??? run in a child process instead of blocking the main loop ???
    return new Promise( async (resolve, reject) => {
      try {
        let repo = await api.input('Docker Hub SQL Server Repo to use:', config.mssql.repo.path)
        let tag = await api.input('Pull Image with Tag:', config.mssql.repo.tag)
        docker.pull(`${repo}:${tag}`, function(err, stream) {
          if (err) {
            pulls.put(err)
            reject(err)
          }
          docker.modem.followProgress(stream, onFinished, onProgress)
          function onProgress(evt) {
            log('progress', '.')
          }
          async function onFinished(err, output) {
            log('progress', '!\n') // bang shows end evt in progress stream
            process.stdout.write(`!\n`) 
            if (err) {
              pulls.put(err)
              reject(err)
            }
            pulls.put(output)
            resolve(true)
          }
        })
      }
      catch(err) {
        reject(err)
      }
    })
  },
  removeImage: () => {
    let dangling = []
    for (image of docker.listImages({dangling: true})) {
      if (sql.catalog.images.has(image.imageId)) dangling.push(image.imageId)
    }  
    if (dangling.length===0) log('warn', `No untagged and unreferenced SQL images found. "Images
      cannot be removed if they have descendant images, are being used by a running container 
      or are being used by a build."`)
    else {
      return api.choose(dangling, 'Unused Images')
      .then( imageId => {
        return docker.image.remove(imageId)
      })
      .then( () => {
        return catalog.intern()
      })
      .catch( err => {
        log('error', `(removeImage) failed\n${err}`)
      })
    }  
  },
  removeInstance: () => {
    return catalog.chooseInstanceId('idle')
    .then( containerId => {
      return docker.getContainer(containerId).remove()
    })
    .then( () => {
      return catalog.intern()
    })
    .catch( err => {
      log('error', `(removeInstance) failed\n${err}`)
    })
  },
  renameInstance: () => {
    return catalog.chooseInstanceId('all', 'Container to be renamed')
    .then( async containerId => {
      return api.input(`New name for Container ${containerId}`)
    })
    .then( (containerId) => {
      const oldName = catalog.sql.ContainerInfos.get(containerId).Names[0] 
      return docker.getContainer(containerId).rename({oldName, name})
    })
    .then( () => {
      return catalog.intern()
    })
    .catch( err => {
      log('error', `(removeInstance) failed\n${err}`)
    })
  },
  restartInstance: async (containerId) => {
    try {
      if (!containerId || !catalog.sql.ContainerInfos.has(containerId)) {
        containerId = await catalog.chooseInstanceId('up')
      }  
      await docker.getContainer(containerId).restart()
      //config.docker.tail.settings.tail=0
      await catalog.tailLog(containerId, 'progress', 0, true)
      await catalog.intern()
      return containerId
    }  
    catch(err) {
      log('error', `(restartInstance) failed\n${err}`)
    }
  },
  runImage: async () => {
    return new Promise( async (resolve, reject) => {
      try {
        imageId = await catalog.chooseImageId('SQL Server Image to run')
        config.mssql.env.MSSQL_SA_PASSWORD = await api.secret(`'sa' password`, config.mssql.env.MSSQL_SA_PASSWORD)
        if (!imageId) {
          reject(new Error(`(runImage) imageId=${imageId}`))
        } else {
        let mounts= []
          for (key of Object.keys(config.docker.bindings)) {
            if (config.docker.bindings[key].mount) {
              await api.addFolder(config.docker.bindings[key].hostPath)
              config.docker.bindings[key].mount.Source=path.resolve(config.docker.bindings[key].hostPath)
              config.docker.bindings[key].mount.Target=path.join(config.docker.bindings.containerPath, name, key)
              mounts.push(config.docker.bindings[key].mount)
            }
          }
          let env = []
          for (let evar of Object.keys(config.mssql.env)) {
            if (config.mssql.env[evar]) {
              env.push(`${evar}=${config.mssql.env[evar]}`)
            }
          }
          let portBindings = { 
            "1433/tcp": [{HostPort: (await getPort()).toString()}],
            "5022/tcp": [{HostPort: (await getPort()).toString()}]  
          }
          return docker.createContainer({
            Image: imageId,
            Env: env,
            HostConfig: {
              Mounts: mounts,
              PortBindings: portBindings
            }
          })
          .then( async container => {
            // could be a scenario where autostart is not desired but I don't see it...
            resolve(await container.start())
          })
          .catch( async err => {
            log('progress',`\n`)
            log('error', `(runImage) error\n${format(err)}`)
          })
        }
      }
      catch (err) {
        log('error', `(runImage) failed\n${err.stack}`)
        resolve(false)
      }
    })
  },
  setDockerRemoteAPI: (cfg=api.Config) => {
    docker=new Docker(cfg)
  },
  sql: sqlCatalog,
  startInstance: async (containerId) => {
    try {
      if (!containerId || !catalog.sql.ContainerInfos.has(containerId)) {
        containerId = await catalog.chooseInstanceId('Idle')
      }  
      config.docker.tail.settings.tail=0
      await docker.getContainer(containerId).start()
      await catalog.tailLog(containerId, 'progress', config.docker.tail.settings, true)
      await catalog.intern()
      return containerId
    }
    catch (err) {
      log('error', `(startInstance) failed\n${err.stack}`) 
    }
  },
  stopInstance: async (containerId) => {
    try {
      if (!containerId || !catalog.sql.ContainerInfos.has(containerId)) {
        containerId = await catalog.chooseInstanceId('up')
      }  
      await docker.getContainer(containerId).stop()
      await catalog.intern()
      return containerId
    }
    catch(err) {
      log('error', `(stopInstance) error\n${err}`)
    }
  },
  tailLog: async (containerId, feedback=`data`, logConfig=config.docker.tail.settings, dumpErrs=false) => {
    return new Promise( async(resolve, reject) => {
      try {
        const logerrs = [], progress='.'
        let rows=0, ignore = false, logDate, datestamp
        if (!containerId) containerId = await catalog.chooseInstanceId('up')
        const container = docker.getContainer(containerId) 
        let state = (await container.inspect()).State
        const logStream = new PassThrough()
        if (feedback==='progress') log('progress',`(tailLog)`) 
        container.logs(logConfig, async (err, stream) => {
          if (err) {
            if (feedback==='progress') log('progress',chalk`{bold.red x}\n`)
            log('error', `(tailLog) containerId: ${containerId}\n${err.stack}`)
            resolve(false)
          }
          logStream.on('data', data => {
            if (!ignore) {
              rows+=1
              switch (true) {
                case (data.includes('SQL Server is now ready')):  // from message_id=17126 
                  if (feedback==='progress') log('progress', chalk.cyan(`!\n`))
                  logDate = data.toString().substring(0, data.indexOf(`spid`)).trim()
                  datestamp = new Date(logDate.endsWith('Z')? logDate: logDate.concat('Z'))
                  log('confirm', chalk.cyanBright(data)) // ??? no ucon printed ??? 
                  if (!state.FinishedAt || datestamp > new Date(state.FinishedAt)) {
                    stream.emit('end')
                    logStream.destroy()
                  }  
                  break
                case (/serror\s/i.test(data) || /\sfail/i.test(data)):
                  if (feedback==='progress') log('progress', chalk`{bold.yellowBright \u2621}`)
                  logerrs.push(`${data}`)
                  break
                case (feedback==='data'):
                  log('log', `${data}`)
                  break
                default:
                  if (feedback==='progress') log('progress', progress)
                  break
              }    
            }    
          })
          await container.modem.demuxStream(stream, logStream, process.stderr)
          stream.on('end', async () => { 
            if (logerrs.length>0) {
              log('warn', chalk`{redBright 'error'} or {redBright 'fail'} mentioned in ${logerrs.length} of ${rows} log record${logerrs.length>1?'s':''} considered`)
              if (dumpErrs) {
                log('log', logerrs)
                logerrs.slice(0)
              }
            }
            resolve()
          })
          setTimeout(() => {
            finished(stream, (reply, err) => {
              if (err) {
                log('error', `(logTail) timeout error\n${format(err)}`)
                stream.destroy() 
              }  
              else if (!reply) {
                stream.emit('end')
              } 
              else { // ??? not reading but did not resolve() ??? else in bad state, 
                stream.destroy()
              }  
              resolve(log('warn', `(tailLog) Log stream has ${config.docker.tail.timeout}ms time out\n` +
              `containerId: ${containerId}\n` +
              `docker: ${stream.socket.parser.outgoing.path}\n` +            
              `logConfig: ${format(logConfig)}\n` +
              `timeoutms: ${config.docker.tail.timeout}\n` +
              `logConfig.since: ${new Date(logConfig.since).toUTCString()} ${new Date(logConfig.since)}`
              ))
            })
          }, config.docker.tail.timeout)
        })
      }
      catch(err) {
        if (feedback==='progress') log('progress',`\n`)
        log('error', `(tailLog) failure, containerId: ${containerId}\n${new Error(err)}`)
        resolve(false)
      }  
    })
   }
}
