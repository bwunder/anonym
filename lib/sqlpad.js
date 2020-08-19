//// NPM
const Docker = require('dockerode')
const getPort = require('get-port')
//// CORE
const path = require('path')
//// LOCAL
const { format, log } = require('../lib/log')
const { genCertificate } = require('../lib/tls')

const { name } = require('../package.json')
const config = require('../config/config.json')

const docker = new Docker()

const sqlpadMap = {
  containers: new Map(),
  images: new Map()
}

module.exports = sqlpad = {
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
      "User": process.user
    }) => {
    new Promise( async (resolve, reject) => {
      try {
        let container = await docker.getContainer(containerId)           
        if ((await sqlpadMap.containers.get(containerId)).State.Status==='running') {
          if (command) options.Cmd.push(command)
          container.exec(options, (err, exec) => {  
            if (err) reject(err)
            exec.start( (err, stream) => {
              if (err) reject(err)
              container.modem.demuxStream(stream, process.stdout, process.stderr)
            })
            resolve(true)
          })
        }
      }
      catch(err) {
        reject(err)
      }
    })
  },
  listContainers: (state) => {
    if (sqlpadMap.containers.size>0) {
      for (let [id, info] of sqlpadMap.containers) {
        if (!state || state===info.State) log('log', info)
      }
    }
  },
  listImages: imageId => {
    if (sqlpadMap.images.size>0) {
      for (let [id, image] of sqlpadMap.images) {
        if (!imageId || imageId===id) log('log', image)
      }
    }
  },
  map: async () => {
    await sqlpad.mapImages()
    if (sqlpadMap.images.size>0) await sqlpad.mapContainers()
  },
  mapContainers: async () => {
    new Promise( async (resolve, reject) => {
      try { 
        for (let image of sqlpadMap.images) {
          let containers = await docker.listContainers({
            "all": true,
            "size": true,
            "filters": { "ancestor": [`${image[0]}`] }
          })
          for (let container of containers) {
            sqlpadMap.containers.set(container.Id.substring(0,12), container)
          }
        }
        resolve()
      }
      catch(err) {
        log('warn', `(sqlpad.mapContainers)\n${err.stack}`)
        return false
      }
    })  
  },
  mapImages: async () => {
    new Promise( async (resolve, reject) => {
      try {
        let images = await docker.listImages()
        for (let image of images) { 
          let digest = image.RepoDigests[0] 
          if (config.sqlpad.repo.path===digest.substring(0, digest.indexOf('@'))) {
            let offset = image.Id.indexOf(':') + 1 || 0
            sqlpadMap.images.set( image.Id.substring(offset, offset+12), image )
          }       
        }
        resolve()
      }  
      catch(err) {
        if (err.code==='EACCES') {
          log('sqlpad', chalk`{yellowBright 'EACESS': user '${process.user}' unauthorized}`)
        } else {
          log('sqlpad', `(sqlpad.mapImages) failed\n${err.stack}`)
        }
      }
    })  
  },
  pullImage: async (repo, tag) => {
    // ??? run in a child process instead of blocking the main loop ???
    return new Promise( (resolve, reject) => {
      try {
        docker.pull(`${repo}:${tag}`, function(err, stream) {
          if (err) {
            pulls.put(err)
            reject(err)
          }
          docker.modem.followProgress(stream, onFinished, onProgress)
          function onProgress(evt) {
            log('progress', '.')
          }
          function onProgress(err, output) {
            log('progress', '.')
            if (err) {
              pulls.put(err)
              reject(err)
            }
            //pulls.put(output)
            resolve(true)
          }
          async function onFinished(err, output) {
            log('progress', '!\n') // bang signals stream end
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
  runImage: async imageId => {
    return new Promise( async (resolve, reject) => {
      try {
        if (!imageId) {
          reject(new Error(`(runImage) imageId=${imageId}`))
        } else {
          return getPort()
          .then( async hostPort => {
            let mounts= []
            for (folder of Object.keys(config.sqlpad.bindings)) {
              if (config.sqlpad.bindings[folder].mount) {
                await api.addFolder(folder)
                config.sqlpad.bindings[folder].mount.Source=path.resolve(folder)
                config.sqlpad.bindings[folder].mount.Target=path.join('/var/opt', name, folder)
                mounts.push(config.sqlpad.bindings[folder].mount)
              }
            }
            let env = []
            for (let evar of Object.keys(config.sqlpad.env)) {
              if (config.sqlpad.env[evar]) {
                env.push(`${evar}=${config.sqlpad.env[evar]}`)
              }
            }
            return docker.createContainer({
              Image: imageId,
              Env: env,
              HostConfig: {
                Mounts: mounts,
                PortBindings: {
                  "3000/tcp": [
                    {
                      HostPort: hostPort.toString()
                    }
                  ]
                }
              }
            })
          })
          .then( async container => {
            resolve(await container.start())
          })
          .catch( (err) => {
            log('error', `(runImage) failed\n${err.stack}`)
            resolve(false)
          })
        }  
      }
      catch (err) {
        log('error', `(runImage) failed\n${err.stack}`)
        resolve(false)
      }
    })
  },
  server: {},
  sqlpadMap: sqlpadMap,  
  start: async (containerId) => {
    return new Promise( async(resolve, reject) => {
      try {
        let info = sqlpadMap.containers.get(containerId)
        if (info) {
        let credsPath = config.sqlpad.env.CERT_PATH
        if (sqlpad.sqlpad) {
          resolve(log('log', `SQLPad is already listening.\n
            bridge: ${info.NetworkSettings.Networks.bridge.IPAddress}:${info.Ports[0].PrivatePort},\n
            localhost: ${info.NetworkSettings.Networks.bridge.Gateway}:${info.Ports[0].PublicPort}`))
        }  
        // use our server-signed CA creds for TLS and basic user auth (oauth needs and feeds Google)
        await genCertificate('sqlpad', 'serverAuth', config.sqlpad.env.CERT_PASSPHRASE)
        // redundant to set the name to the default (.sid) but code is now plumbed for another 
        //"SQLPAD_COOKIE_NAME": "default-is-sqlpad.sid",
log('confirm', `session: ${format(session)}`)        
log('confirm', `sqlpad.sid: ${sqlpad.sid}`)        
        config.sqlpad.env.SQLPAD_COOKIE_NAME=sqlpad.sid
        // attach child to import obj so cli can find it later
        sqlpad.sqlpad = spawn('sqlpad')
        sqlpad.sqlpad.on('error',  err => {
          log('error', chalk`(sqlpad) {red error}\n${err}`)
        })
        sqlpad.sqlpad.stdout.on('data', data => {
          if (/Welcome/.test(data)) {            
            config.sqlpad.protocol= data.toString().includes('https:')?'https':'http'
            resolve(api.log('log', chalk.cyan.bold(data) +
              chalk`\n{bold (sqlpad)} browser wih V8 is required (e.g., Chrome or Chromium)`))
            } else {
            if (sqlpad.debug) {
              // debug basically means verbose server output to our cli
              api.log('debug', chalk`{cyan.bold (sqlpad)} {gray ${data}}\n {yellowBright SQLPad debug is enabled}`)
            }
          }
        })
        sqlpad.sqlpad.stderr.on('data', err => {
          api.log('log', chalk`{cyan.bold (sqlpad)}  {red error}\n${err}`)
        })
        sqlpad.sqlpad.on('exit', code => {
          api.log('warn', chalk`{cyan.bold (sqlpad)} {gray server has exited} code: ${code||0}`)
          sqlpad.sqlpad={}
        })  

        }
      }
      catch(err) {
        api.log('error', `(startSQLPad) error`)
        reject(err)
      }
    })
  },
  status: async (containerId) => {
    let container = await docker.getContainer(containerId)
    if (sqlpadMap.containers.has(containerId)) resolve(log('log', container.status()))
    else resolve(log('error', `(SQLPad.start) container ${containerId} not found in local SQLPad container inventory`))
  },
  stop: async (containerId) => {
    let container = await docker.getContainer(containerId)
    if (sqlpadMap.containers.has(containerId)) resolve(container.stop())
    else resolve(log('error', `(SQLPad.start) Container ${containerId} not found in local SQLPad inventory`))
  }
}


