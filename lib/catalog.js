//// NPM
const chalk = require('chalk')
const Docker = require('dockerode')
const getPort = require('get-port')
//const k8s = require('@kubernetes/client-node') // haven't installed it
//// core
const { mkdirSync } = require('fs')
const path = require('path')
const { end, PassThrough } = require('stream')
//// local  
const { format, log } = require('./log')
const { openPool } = require('./sqldb')
const { pools, pulls } = require('./store')

const config = require('../config/config.json')

let docker = new Docker()
let sqlCatalog = {}

module.exports = catalog = {

  closeInstance: async containerId => {

    return Promise.resolve(catalog.sql.Pools.get(containerId).close())
      .then( () => {
        catalog.sql.Pools.delete(containerId)
      })

  },
  getDAPIContainer: async containerId => {
    
    await docker.getContainer(containerId)

  },
  getInstanceInfo: containerId => {

    if (containerId && catalog.sql.ContainerInfos.has(containerId)) {
      return catalog.sql.ContainerInfos.get(containerId)
    }

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
              localhost: `${info.NetworkSettings.Networks.bridge.Gateway}:${info.Ports[0].PublicPort}`
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
        let container = await docker.getContainer(containerId)
        let options = {
          Cmd: [config.cli.bash.path, '-c', `echo ${varName}`],
          AttachStdout: true,
          AttachStderr: true
        }
        container.exec(options, (err, exe) => { // Exec {modem:{Modem {...}}id: of ? - not the container}
          if (err) reject(err)
          exe.start( (err, stream) => { // stream is http socket
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
        resolve(log('error', `(getEnvVariables) container: ${containerId}\n${format(err)}`))
      }
    })

  },
  getImage: async imageId => {

    return new Promise( async (resolve, reject) => {
      try {
        if (!imageId) {
log('confirm', `catalog.sql.Images.size===0 ${catalog.sql.Images.size===0}`)
log('confirm', `catalog.sql.Images.size===1 ${catalog.sql.Images.size===1}`)
log('confirm', `(catalog.sql.Instance) ${catalog.sql.Instance}`)
log('confirm', `catalog.sql.Images.get(imageId) ${catalog.sql.Images.get(imageId)}`)
          if (catalog.sql.Images.size===0) resolve(log('warn', `No images in catalog, try 'image --pull'`))
          else if (catalog.sql.Images.size===1) resolve(catalog.sql.Images.get(catalog.sql.Images.keys().next()))
          else if (catalog.sql.Instance) resolve(catalog.sql.Images.get(catalog.getInstanceInfo(catalog.sql.Instance).ImageID))
          else resolve(catalog.sql.Images.get((await catalog.latestImage()).Id))
        } else resolve(catalog.sql.Images.get(imageId))
      }
      catch(err) {
        log('error', `(getImage) imageId: ${imageId}\n${format(err)}`)
        resolve(false)
      }
    })

  },
  getProcesses: async containerId => {

    return new Promise(async (resolve, reject) => {
      try{
        if (containerId && catalog.sql.ContainerInfos.get(containerId).State==='running') {
          resolve((await docker.getContainer(containerId)).top("-x"))
        } else {
          log('warn', `(getProcesses) container not ready: ${containerId}`)
          resolve(true)
        }
      }
      catch (err) {
        log('error', `(getProcesses) container: ${containerId}\n${format(err)}`)
        resolve(false)
      }
    })

  },
  intern: async instanceId => {

    return new Promise( async (resolve, reject) => {
      try {
        if (await catalog.isHost()) {
          instanceId = (instanceId || await pools.getLastInstanceId()).substring(0,12)
          catalog.sql.Images = new Map()
          catalog.sql.ContainerInfos = new Map()
          catalog.sql.Instance = ''
          catalog.sql.Pools = catalog.sql.Pools || new Map() 
          log('progress', `\u2042  `)
          if (await catalog.internImages()) {
            if (await catalog.internContainers()) {
              if (!instanceId) {
                if (catalog.sql.ContainerInfos.size===1) {
                  instanceId=catalog.sql.ContainerInfos.keys().next()
                } else if (listInstances('running').length===1) {
                    instanceId = listInstances('running')[0]                  
                }
              }
            }
            log('progress', `\n`)
            if (catalog.sql.ContainerInfos.has(instanceId)) {
              await catalog.internInstance(instanceId)
              if (instanceId===catalog.sql.Instance) { 
                if (catalog.sql.ContainerInfos.get(instanceId).State==='running') {
                  log('log', chalk`\u2042  Target: {bold.cyan ${instanceId}}`)
                  resolve(true) //open the target instance
                } else {
                  log('log', chalk`\u2042  {yellow Targeted SQL Server not running'}: ${instanceId}`)
                  resolve(false)
                }
              } else {
                log('log', chalk`\u2042  {red Targeted SQL Server not found}: ${instanceId}`)
                resolve(false)
              }
            } else {
              log('log', chalk`\u2042  {yellow No Local SQL Containers found}`)
              resolve(false)
            }
          } else {
            log('log', chalk`\u2042  {{yellow No Local SQL Images found}\n{rgb(127,255,0) check engine}`)
            resolve(false)
          }  
        } else {
          log('log', chalk`\u2042  {red Docker engine not detected on host}\n{rgb(127,255,0) check engine}`)
          resolve(false)
        }
      }
      catch(err) {
        log('error', `(intern) \n${format(err)}`)
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
            log('progress', chalk.green`\u25CF`)
          } else {
            log('progress', chalk.red`\u25C9`)
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
      log('warn', `\u2042 (InternContainers)\n${format(err)}`)
      return false
    }

  },
  internImages: async () => {
    // will be first place to fail at startup if user not in docker group or tls is broken
    // sudo usermod -aG docker $USER 
    try {

      let images= await docker.listImages()
      let repos=[ config.docker.pull.oldRepo, config.docker.pull.repo, config.docker.pull.nextRepo]
      for (let image of images) { 
        if (image.RepoDigests.find( (digest) => { return repos.includes(digest.substring(0, digest.indexOf('@')))})) {
          let shortid = image.Id.includes(':')? image.Id.substring(image.Id.indexOf(':')+1, image.Id.indexOf(':')+1+12): image.Id.substring(0, 12)
          catalog.sql.Images.set(shortid, image) 
          log('progress', chalk.blue`\u25B2`)  
        }       
      }
      if (catalog.sql.Images.size===0) {
        return false
      } else {
        return true
      }
    }  
    catch(err) {
      log('progress', '\n')
      if (err.code==='EACCES') {
        log('log', chalk`\u2042 {yellow 'EACESS': user '${process.user}' unauthorized}`)
      } else {
        log('log', `\u2042 (InternImages) failed\n${format(err)}`)
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
      log('warn', `\u2042 (internInstance) failed, container ${instanceId}\n${format(err)}`)
      return false
    }

  },
  internPool: async (instanceId=catalog.sql.Instance, config) => {
    // pools added to catalog will be explicitly closed at app exit
    try {
      await pools.update(instanceId, config)
      catalog.sql.Pools.set(instanceId, await pools.get(instanceId))
      return true
    }
    catch(err) {
      log('warn', `\u2042 (internPool) failed, container ${instanceId}\n${format(err)}`)
      return false
    }

  },
  isHost: async () => {

    return new Promise( async (resolve, reject) => {
      try {
        if (typeof docker==='undefined') {
          resolve(false) 
        } else {
          await docker.ping()          
          resolve(true)
        } 
      }
      catch(err) {
        log('error', `(isHost) ${format(err)}`)
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
        log('error', `(latestInstances) error\n${format(err)}`)
        resolve(false)
      })

  },
  latestImage: () => {

    for (let image of docker.listImages()) {  // docker.getImage(name) wtf? image.name?
      if (image.RepoTags) {
        for (let tag of image.RepoTags) {
          if (tag===`${config.docker.pull.repo}:${config.docker.pull.tag}`) {
            return image
          }
        }
      }
    }

  },
  listInstances: state => {

    let list=[]
    let id=''
    let info={}
    if (catalog.sql.ContainerInfos.size>0) {
      for ([id, info] of catalog.sql.ContainerInfos) {
        if (!state || state==info.State) {
            list.push(info)
        }
      }
    }
    return list

  },
  listInstanceIds: (upidleall='all') => {

    let list=[]
    let id=''
    let info={}
    if (catalog.sql.ContainerInfos && catalog.sql.ContainerInfos.size>0) {
      for ([id, info] of catalog.sql.ContainerInfos) {
        if (['up', 'all'].includes(upidleall) && info.State==='running') {
          list.push(id)
        } else if (['idle', 'all'].includes(upidleall) && info.State!=='running') {
          list.push(id)
        } 
      }
    }
    return list

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
  listPools: containerId => {

    let list=[]
    if (catalog.sql.Pools.size>0) {
      for (let [id, pool] of catalog.sql.Pools) {
        if (!containerId || containerId==id) {
          list.push([id, pool])
        }
      }
    }
    return list

  },
  pullImage: async (repo, tag) => {

    return new Promise( (resolve, reject) => {
      try {
        docker.pull(`${repo}:${tag}`, function(err, stream) {
          if (err) {
            pulls.put(err)
            reject(err)
          }
          docker.modem.followProgress(stream, onFinished, onProgress)
          function onProgress(evt) {
            process.stdout.write('.')
          }
          async function onFinished(err, output) {
            process.stdout.write(`!\n`) // the bang signals finished event
            if (err) {
              pulls.put(err)
              reject(err)
            }
            pulls.put(output)
            await catalog.intern()
            resolve(output)
          }
        })
      }
      catch(err) {
        reject(err)
      }
    })

  },
  removeInstance: async containerId => {

    if (catalog.sql.ContainerInfos.has(containerId)) {
      await docker.getContainer(containerId).remove()
    }

  },
  renameInstance: async (containerId, name) => {

    if (catalog.sql.ContainerInfos.has(containerId)) {
      let oldName = catalog.sql.ContainerInfos.get(containerId).Names[0] 
      await docker.getContainer(containerId).rename({oldName, name})
    }

  },
  restartInstance: async (containerId=catalog.sql.Instance) => {

    if (catalog.sql.ContainerInfos.get(containerId).State==='running') {
      log('progress',`restarting.`)
      return await docker.getContainer(containerId).restart()
        .then( async () => {
          await catalog.tailLog(containerId, 0, false)
        })
        .catch( async err => {
          log('error', `(restartInstance) malfunction\n${format(err)}`)
        })
    } else {
      log('warn', chalk`(restartInstance) ${containerId} is not running, did you mean {bold container --start}`)
    }

  },
  runImage: async imageId => {

    return new Promise( async (resolve, reject) => {
      try {
        if (!imageId) {
          reject(new Error(`(runImage) imageId=${imageId}`))
        } else {
          return getPort()
            .then( async hostPort => {
              try {
                config.docker.bindings.backups.mount.Source=path.resolve(config.docker.bindings.backups.mount.Source)
                mkdirSync(path.resolve(config.docker.bindings.backups.mount.Source))
              }
              catch (err) {
                if (err.code!=='EEXIST') reject(err)
              }
              try {
                config.docker.bindings.private.mount.Source=path.resolve(config.docker.bindings.private.mount.Source)
                mkdirSync(path.resolve(config.docker.bindings.private.mount.Source))
              }
              catch (err) {
                if (err.code!=='EEXIST') reject(err)
              }
              try {
                config.docker.bindings.staging.mount.Source=path.resolve(config.docker.bindings.staging.mount.Source)
                mkdirSync(path.resolve(config.docker.bindings.staging.mount.Source))
              }
              catch (err) {
                if (err.code!=='EEXIST') reject(err)
              }
              let mounts= [
                config.docker.bindings.backups.mount,
                config.docker.bindings.private.mount,
                config.docker.bindings.staging.mount
              ]
              let env = []
              for (let evar of Object.keys(config.mssql.env)) {
                if (config.mssql.env[evar]) {
                  env.push(`${evar}=${config.mssql.env[evar]}`)
                }
              }
              return docker.createContainer({
                Image: imageId,
                Env: env,
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
            .then( async container => {
              await container.start()
              resolve(await catalog.intern())
            })
        }
      }
      catch (err) {
        log('error', `(runImage) ${format(err)}`)
        resolve(false)
      }
    })

  },
  setDockerRemoteAPI: (config) => {

    docker=new Docker(config)

  },
  sql: sqlCatalog,
  startInstance: async (containerId=catalog.sql.Instance) => {

    if (catalog.sql.ContainerInfos.get(containerId).State!=='running') {
      log('progress',`starting.`)
      return docker.getContainer(containerId).start()
        .then( async () => {
          await catalog.tailLog(containerId,0,false)
        })
        .catch( err => {
          log('warn', `(startInstance) malfunction`)
          log('error', err)
        })
    } else {
      log('warn', chalk`(startInstance) ${containerId} is already running, try {bold container --restart} ?`)
    }

  },
  stopInstance: async (containerId=catalog.sql.Instance) => {

    if (containerId && catalog.sql.ContainerInfos.has(containerId)) {
      if (catalog.sql.ContainerInfos.get(containerId).State==='running') {
        await docker.getContainer(containerId).stop()
      }
    }

  },
  tailLog: async (containerId, tail="0", feedback=true, follow=true, since, until) => {

    // feedback inicates whther to write data (true) or display a progress progress
    // tail string    Number of lines to show from the end of the logs (default "all")
    // follow bool    Follow log output
      // timestamps     Show timestamps
    // since string   Show logs since timestamp (e.g. 2013-01-02T13:23:37) or relative (e.g. 42m for 42 minutes)
    // until string   Show logs before a timestamp (e.g. 2013-01-02T13:23:37) or relative (e.g. 42m for 42 minutes)  
    return new Promise( async (resolve, reject) => {
      try {
        let container = await docker.getContainer(containerId) 
        if (container) {
          if (feedback) log('progress',`tailing log.`)
          let logStream = new PassThrough()
          let tailConfig = {
            tail: tail,
            stdout: true,
            stderr: true
          }
          if (follow) tailConfig.follow=follow
          if (since) tailConfig.since=since
          if (until) tailConfig.until=until
          //        since: since,
          container.logs(tailConfig, (err, stream) => {
            if (err) {
              log('error', `(tailLog) containerId: ${containerId}\n${format(err)}`)
              resolve(false)
            }
            container.modem.demuxStream(stream, logStream, logStream)
            stream.on('data', data => {
              switch (true) {
              case (tail==='all' || feedback):
                log('log', `${data}`)
                break
              case (data.includes('SQL Server is now ready')):
                log('progress', chalk`{bold.cyan ready!}`)
                stream.emit('close')
                break
              case (/error\s/i.test(data)):
              log('progress', `\n`)
                log('error', data)
                break
              default:
                log('progress', '.')
                break
              }
            })
            stream.on('close', () => {
              resolve(log('progress', `\n`))
            })
          })
        }
      }
      catch(err) {
        log('error', `(tailLog) containerId: ${containerId}\n${format(err)}`)
        resolve(false)
      }  
    })

  }

}
