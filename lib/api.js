////NPM
const Docker = require('dockerode')
const chalk = require('chalk')
const { edit } = require('external-editor')
const getPort = require('get-port')
//const pem = require('pem')
////core
const { PassThrough } = require('stream')
const { exec, spawn, execSync, spawnSync } = require('child_process') // exec is too ambiguous
const { writeFile, readFile, existsSync, statSync, readdir, mkdirSync } = require('fs')
const path = require('path') // DO NOT destructure - join() ambiguous & resolve() conflicts w/promises
const { inspect } = require('util')
////local
const store = require('../lib/store')
//const { openPool } = require('../lib/sqldb')

const config = require('../config/config.json')
const { version } = require('../package.json')

const docker = new Docker()
// conts docker = new Docker({
//   socketPath: '/var/run/docker.sock',
//   ca: fs.readFileSync('private/CA-cert.pem'),
//   cert: fs.readFileSync('private/docker-cert.pem'),
//   key: fs.readFileSync('private/docker-key.pem')
// });
var api
module.exports = exports = api = {
  addFile: async (textFile) => {

    return new Promise(async function(resolve, reject) {
      let text = await api.editText('')
      writeFile(textFile, text, (err) => {
        if (err) {
          api.log('error', `(addFile) writeFile error ${textFile}`)
          reject(err)
        }
        resolve()
      })
    })

  },
  archiveQueries: async (textFile) => {

    return new Promise(async function(resolve, reject) {
      let collection = await store.queries.extract()
      let obj = "module.exports = {\n"
      for (let qry of collection) {
        obj += `${qry.name}: \u0060${qry.text}\u0060,\n` 
      }
      obj += '}'
      writeFile(textFile, obj, 'utf8', (err) => {
        if (err) {
          api.log('error', `(archiveQueries) writeFile error ${textFile}`)
          reject(err)
        }
        return resolve()
      })
    })

  },
  bandAid: () => {
    return chalk`\n\t\t {bold.italic ${api.roygbv}}{green   _ Q _ \n\t\t\t   |   \n\t\t\t  / \\  } ${version}\n`
  },
  batch: [''],
  checkNPM: async () => {

    return new Promise(function(resolve, reject) {
      exec(`npm outdated`, {}, (err, result) => {
        if (err) reject(err)
        store.npm.put(result)
        resolve(result|| 'up to date')
      })
    })

  },
  cliAid: () => {

    return chalk`{bold sqlpal quickstart}:
      {italic.bold ${'engine    start'.padEnd(40)}}  Start the Docker Container Engine Instance.
      {italic.bold ${'catalog'.padEnd(40)}} Review local SQL Server Images, Containers and Connection Pools.
      {italic.bold ${'image     pull'.padEnd(40)}}  Fetch '${config.docker.pull.repo}:latest' image from dockerhub.com if newer.
      {italic.bold ${'image     run    [image-id]'.padEnd(40)}}  Start a new SQL Server container from a local image.
      {italic.bold ${'container [container-id] --target'.padEnd(40)}} Target CLI queries at an existing SQL Server Container.

      User may enter lines of T-SQL bound for cache or run a CLI command at the prompt.
      Type {italic.bold help} (no dashes) for a descriptive Vorpal index of this CLI's commands.
      Type {italic.bold --help} for additional usage information about this CLI.`

  },
  closeInstance: async (containerId) => {

    return Promise.resolve(api.sqlCatalog.Pools.get(containerId).close())
      .then( () => {
        api.sqlCatalog.Pools.delete(containerId)
      })

  },
  commandAid: (cmds) => {

    let admin=[], builtin=[], cli=[], cat=[], inject=[], term=[]
    cmds.forEach( (cmd) => {
      switch(true) {
      case(['log', 'file', 'sqlpad'].includes(cmd._name.toLowerCase())):
        admin.push(`${chalk.rgb(0, 0, 255)(cmd._name).padEnd(25)}\t${cmd._description}`)
        break
      case(['help', 'exit', 'loglevel'].includes(cmd._name.toLowerCase())):
        builtin.push(`${chalk.italic.rgb(153, 0, 153)(cmd._name).padEnd(25)}\t${cmd._description}`)
        break
      case(['query', 'script'].includes(cmd._name.toLowerCase())):
        inject.push(`${chalk.rgb(255, 136, 0)(cmd._name).padEnd(25)}\t${cmd._description}`)
        break
      case(['go', 'run', 'sqlcmd', 'issql'].includes(cmd._name.toLowerCase())):
        term.push(`${chalk.rgb(255, 255, 0)(cmd._name).padEnd(25)}\t${cmd._description}`)
        break
        // case(['bcp', 'bulk'].includes(cmd._name.toLowerCase())):
        //   etl.push(`${chalk.yellow(cmd._name).padEnd(25)}${cmd._description}`)
        //   break
      case(['engine', 'image', `container`].includes(cmd._name.toLowerCase())):
        cat.push(`${chalk.rgb(0, 255, 0)(cmd._name).padEnd(25)}\t${cmd._description}`)
        break
      case(['about', 'batch', `catalog`, 'configuration', `history`, 'use', 'certificate'].includes(cmd._name.toLowerCase())):
        cli.push(`${chalk.rgb(255, 0, 0)(cmd._name).padEnd(25)}\t${cmd._description}`)
        break
      default:
        break
      }
    })
    return [
      chalk`${api.roygbv} DEV/Test Anonyms - SQL Server for Linux in Containers

        Input at the prompt is processed when the {bold.italic [ENTER]} key follows. 
        Either a CLI command is recognized and initiated or the text is appended to a cache of text 
        lines the {bold.italic Batch}. When a {italic.rgb(255, 255, 0) Terminating} command  is {bold.italic [ENTER]}-ed 
        on a new line, the {bold.italic Batch} is executed on the targeted SQL Server. If instructed to do 
        so, the query can first be parsed on that same SQL Server to validate the TSQL with no execution. 
        The accumulated TSQL can be edited (or abandoned) at any time before execution. After a successful 
        execution, the {bold.italic Batch} is cleared. 
        
        CLI Commands may be entered regardless if the Batch holds text. Commands that do not use the Batch 
        will not affect the Batch. 

      ${chalk.underline.rgb(255, 0, 0)(`CLI`)}       CLI instrumentation commands
      \t${cli.join('\n\t')}
      ${chalk.underline.rgb(255, 136, 0)(`Inject`)}    CLI stored T-SQL query or script
      \t${inject.join('\n\t')}
      ${chalk.underline.rgb(255, 255, 0)(`Terminate`)} Compile and process the Batch
      \t${term.join('\n\t')}
      ${chalk.underline.rgb(0, 255, 0)(`Docker`)}    Manage Docker Containers
      \t${cat.join('\n\t')}
      ${chalk.underline.rgb(0, 0, 255)(`Target`)}    Administer the Target SQL Server
      \t${admin.join('\n\t')}
      ${chalk.underline.rgb(153, 0, 153)(`Vorpal`)}    Vorpal Built-ins
      \t${builtin.join('\n\t')}

      All CLI commands and options - including {bold.italic go} & {bold.italic use} - are lower case and case sensitive.
      Any UPPERCASE or MixedCase words - even if matching a command's spelling - go into the Batch cache.
      Only the {bold.italic run} or {bold.italic sqlcmd} commands can process a batch that includes upper or mixed case
      'GO' or 'Use' directives. Batches submitted using the {bold.italic run} command will be tested in full using
      the underlying logic of the {bold.italic issql} command before execution to help prevent
      corruption from mid-scipt syntax error failures.

      {underline Vorpal TAB Autocompletion}
      Hit {italic.bold [TAB][TAB]} (no command, just tabs) to preview all available commands by name.
      Use {italic.bold --[TAB][TAB]} (two dashes before the tabs) after any command to preview that commands options.
      Type the first few characters - until unique - then {italic.bold [TAB][TAB]} to fill in any command, option value or argument.

      Either {bold.italic help <command>} or {italic.bold <command> --help} will show a command\'s usage details.
      Command args and option values may be either {italic.bold <required>} when angle bracketed  or {italic.bold [optional]} when square bracketed.`
    ]
  },
  compile: (metadata) => {

    let str = ''
    if (!metadata) { // no passed arg use, cache
      str= api.batch.join('\n')
    } else if (!Array.isArray(metadata)) { // from object arg
      Object.keys(metadata).forEach((key) => {
        if (!['i', 'q', 'Q'].includes(key)) {
          str+= key.length===1? ` -${key}`: ` --${key}`
          if (key!==metadata[key]) {
            str+= ` '${metadata[key]}'`
          }
        }
      })
    } else { // from string or string array arg
      str = metadata.join('\n').replace(/`/g, '\'')
    }
    return str // one string

  },
  developFile: async (textFile) => {

    api.log('log', `opening '${textFile}' in '${config.cli.ide}'`)
    if (!textFile.endsWith('sql')) {
      api.log('log', `Saved changes may not be recognized until ${api.roygbv} is restarted`)
    }
    spawn(config.cli.ide, [path.resolve(textFile)])

  },
  editFile: async (textFile) => {

    // works with emacs, kwrite and vim but atom-beta can't seem to find the temp file xedit uses
    return new Promise(function(resolve, reject) {
      let newtext
      readFile(textFile, 'utf8', async (err, text) => {
        if (err) {
          api.log('error', `(editFile) readFile error ${textFile}`)
          reject(err)
        } else {
          newtext = await api.editText(text)
          if (text!==newtext) {
            writeFile(textFile, newtext, (err) => {
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
      try {
        if (!config.cli.editor) {
          api.log('warn', `config.cli.editor undefined, try 'vim'`)
        }
        process.env.EDITOR=config.cli.editor
        text = edit(text)
        return resolve(text)
      }
      catch(err) {
        reject(err)
      }
    })

  },
  elevate: async (bashCommand) => {

    // no shell prompt using vscode debug - useless for CLI development or testing 
    return new Promise( async function(resolve, reject) {
      try {
        api.log('log', chalk`{rgb(136,153,0) {bold \u2BAD}}  ${bashCommand}`)
        // should be only live mention of sudo anywhere in app
        exec(`sudo ${bashCommand}`, (err, stdout, stderr) => {
          if (err) {
            if (err.code) {
              resolve(api.log('error', `(elevate) callback error ${api.format(err)}`))
            } else {
              // hot potato
              reject(new Error(`(elevate) subprocess returned an exception:\n${api.format(err)}`))
            }
          }
          // handled by subprocess io stream
          if (stderr) resolve(api.log('error', `(elevate) subprocess:stderr ${api.format(stderr)}`))
          resolve(stdout.trim())
        })
      }
      catch(er) {
        reject(er)
      }
    })

  },
  enumContainers: async(state) => {

    let ids = []
    if (api.sqlCatalog.ContainerInfos) {
      for (let info of api.sqlCatalog.ContainerInfos) {
        if (!state || info[1].State===state) {
          ids.push(info[0])
        }
      }
    }  
    return ids

  },
  enumImages: () => {

    let ids = []
    if (api.sqlCatalog.Images) {
      for (let image of api.sqlCatalog.Images.keys()) {
        ids.push(image)
      }
    }
    return ids

  },
  enumPools: () => {

    let ids = []
    if (api.sqlCatalog.Pools) {
      for (let pool of api.sqlCatalog.Pools.keys()) { 
        ids.push(pool)
      }
    }
    return ids

  },
  fileToBatch: async (scriptFile) => {

    return new Promise(function(resolve, reject) {
      readFile(scriptFile, 'utf8', (err, script) => {
        if (err) reject(err)
        if (!script) {
          api.log('error', `No script ${scriptFile}`)
        } else {
          api.batch.splice(0)
          api.batch.push(`-- ${scriptFile}`)
          for (let line of script.split('\n')) {
            api.batch.push(line)
          }
          return resolve()
        }
      })
    })

  },
  fileToJSON: async (fromFile) => {

    return new Promise(function(resolve, reject) {
      readFile(path.resolve(fromFile), 'utf8', (err, data) => {
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
          go = inspect(gi, {colors:true,depth:3})
        }
      }
      catch(e) {
        go = gi
      }
      break
    case ('object'):
      switch (true) {
      case (Buffer.isBuffer(gi)):
        go = gi.toString()
        break
      case (Array.isArray(gi)):
        gi.forEach(function(result) {
          if (typeof result==='object') {
            // util.inspect does not line feed after the last line nor carriage return before the first?
            go+= inspect(result, {colors:true,depth:3}) + '\n'
          } else {
            go+=result
          }
        })
        break
      default:
        if (gi && gi.recordset && gi.recordsets) {
          gi.recordsets.forEach(function(rs) {
            go += inspect(rs, {colors:true,depth:3})
          })
        } else {
          go = inspect(gi, {colors:true,depth:3})
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
    // let available = (await docker.listVolumes()).Volumes.find( volume => volume.Name==='private')
    // if (available.find( volume => volume.Name==='test')) {
    //   api.log('confirm', available.find( volume => volume.Name==='test'))
    //   api.log('confirm', available.find( volume => volume.Name==='private'))
    // } else {
    // api.log('confirm', await docker.createVolume({name: 'test'}))
    //// api.log('confirm', await docker.getVolume('test').inspect())
    ///// api.log('confirm', await docker.getVolume('test').remove())
    // }

    return new Promise( async function(resolve, reject) {
      try {
        // volume name always private, app link can be renamed if/as desired
        // ??? can I leave the pkey (and maybe CA too???) in the app folder so is never in any sql container ???
        let caKey = path.resolve(config.volume.private.appLink,'CA-key.pem')
        let caCert = path.resolve(config.volume.private.appLink,'CA-cert.pem')
        let cnf =  path.resolve(`config/openssl.cnf`)
        let vols = (await docker.listVolumes()).Volumes
        let keyvol = vols.find( volume => volume.Name==='private')
        if (!keyvol) keyvol = await docker.createVolume({name: 'private'})
        // sudo prompt at startup
        // fat finger it 
        try {
          let symLink = await api.elevate(`ls -dH ${config.volume.private.appLink}`)
          if (symLink!==config.volume.private.appLink) {
            throw(new Error(`Symbolic Link ${config.volume.private.appLink} to Docker volume 'private' not found`))
          }
        }
        catch(err) {
          api.log('log', err.message)
          await api.elevate(`ln -s ${keyvol.Mountpoint} '${config.volume.private.appLink}'`)
        }
        api.elevate(`ls -b ${config.volume.private.appLink}/`)
          .then( async (CA) => {
            if (CA) {
              if (!CA.split('\n').find(file => file==='CA-key.pem') && !CA.split('\n').find(file => file==='CA-cert.pem')) {
                await api.elevate(`openssl genrsa -aes256 -out ${caKey} -passout pass:${config.ca["pkey-password"]} 2048`)
              }
            }
            return api.elevate(`ls -b ${config.volume.private.appLink}/`)
          })
          .then( async (CA) => {
            if (CA.length>0) {
              if (CA.split('\n').find(file => file==='CA-key.pem') && !CA.split('\n').find(file => file==='CA-cert.pem')) {
                await api.elevate(`openssl req -new -config ${cnf} -key ${caKey} -passin pass:${config.ca["pkey-password"]} -x509 -days 1000 -out ${caCert} -batch`)
              }
            }
          })
          .catch( (err) => {
            api.log('error', `(genCA) err ${api.format(err)}`)
          })
          .then( () => {
            resolve()
          })
      }
      catch (err) {
        reject(err)
      }
    })

  },
  genCertificate: (purpose, keyPassword) => {

    return new Promise(async function(resolve, reject) {
      try {
        if (!existsSync(path.resolve('private'))) await api.genCA()
        let caKey = path.resolve(config.volume.private.appLink, `CA-key.pem`)

        //TODO encrypt caPassword into the nedb, use the pattern for other passwords

        let caCert = path.resolve(config.volume.private.appLink , `CA-cert.pem`)
        let key = path.resolve(config.volume.private.appLink, `${purpose}-key.pem`)
        let signingReq = path.resolve(config.volume.private.appLink, `${purpose}-signingReq.csr`)
        let cert = path.resolve(config.volume.private.appLink, `${purpose}-cert.pem`)
        let cnf =  path.resolve(`config/openssl.cnf`)
        if ((await api.elevate(`ls ${caKey}`)).status===0 && (await api.elevate(`ls ${caCert}`)).status===0) {
          await api.elevate(`rm ${cert} ${signingReq} ${key}`)
          await api.elevate(`openssl genrsa -aes256 -passout pass:${keyPassword} -out ${key} 2048`)
          if ((await api.elevate(`ls ${key}`)).status===0 ) {
            await api.elevate(`openssl req -new -config ${cnf} -key ${key} -passin pass:${config.ca.password} -out ${signingReq} -batch`)
          }
          if ((await api.elevate(`ls ${signingReq}`)).status===0) {
            await api.elevate(`openssl x509 -req -days 365 -in ${signingReq} -CA ${caCert} -CAkey ${caKey} -passin pass:${keyPassword} -CAcreateserial -out ${cert}`)
            resolve(api.log('confirm', `(genCertificate) ${purpose} certificate ready`))
          } else {
            reject(new Error('(genCertificate) certificate not generated'))
          }
        }
      }
      catch (err) {
        api.log('error', `(genCertificate) error ${err.message}`)
        reject(err)
      }
    })

  },
  getAddress: (containerId) => {

    let addressMap=new Map()
    if (containerId && api.sqCatalog.ContainerInfos.has(containerId)) {
      let info = api.sqCatalog.ContainerInfos.get(containerId)
      if (info.State==='running') {
        addressMap.set(id, {
          bridge: `${info.NetworkSettings.Networks.bridge.IPAddress}:${info.Ports[0].PrivatePort}`,
          localhost: `${info.NetworkSettings.Networks.bridge.Gateway}:${info.Ports[0].PublicPort}`
        })
      }  
    } else {
      if (api.sqlCatalog.ContainerInfos.size>0) {
        let id, info
        for ([id, info] of api.sqlCatalog.ContainerInfos) {
          if (info.State==='running') {
            addressMap.set(id, {
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

    return new Promise(async function(resolve, reject) {
      try {
        let container = await docker.getContainer(containerId)
        let options = {
          Cmd: [config.cli.bash.path, '-c', `echo ${varName}`],
          AttachStdout: true,
          AttachStderr: true
        }
        container.exec(options, function(err, exe) { // Exec {modem:{Modem {...}}id: of ? - not the container}
          if (err) return
          exe.start(function(err, stream) { // stream is http socket
            if (err) return
            stream.on('data', data => {
              // trips eslint no-control-regex. OK because this REMOVES control characters,
              // danger is that ignoring the lint message or disabling filter could lead to mistake or attack
              // ignoring the lint message and leaving the control codes for now...
              resolve(data.toString().replace(/[\x00-\x1F\x7F-\x9F]/g, ""))
            })
            stream.on('error', err => {
              reject(err)
            })
          })
        })
      }
      catch (err){
        api.log('warn', `(getProcesses) error container: ${containerId}`)
        reject(err)
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
      try {
        if (!imageId) {
          if (api.sqlCatalog.Images.size===0) {
            api.log('warn', `No SQL Server images in catalog, use 'image --pull' to get latest`)
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
            }
          }
        }
        return resolve(api.sqlCatalog.Images.get(imageId))
      }
      catch(err) {
        reject(err)
      }
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
  hotelJuliet: () => {
    api.log('error', chalk.red(`
        The root credentials for the local self-signed authority's encryption hierarchy
      are corrupt or compromised. No connection data, cyphers, hashes, signatures or cli
      history are available without this local authority.
        Restore 'CA-key.pem' and 'CA-cert.pem' from known good backup before forcing
      a rekey to preserve existing data. If
        To rekey when corrupted credential backups are not available, move all keys
      and certifiate out of the ./${config.volume.private.appLink} subfolder and {bold.italic certificate --ca}.
      When the existing CA is not corrupt obfuscations will be deciphered and signatures
      validated using the old keys and then the new key and certificate will be applied.
        Recovery of hashed secrets is not possible unless the original values are available
      externally. The likely remedy will be to truncation of existing hashed data.`))
    // rename existing CA creds with a sequence clue or date
    // gen new CA certificate --ca
    // iterate over other creds and gen new
  },
  interactiveShell: (containerId, command='') => {

    //
    return new Promise(function(resolve, reject) {
      try {
        // one size fits all
        let spawnArgs = [`exec`, `--interactive`, `--tty`, `${containerId}`, config.cli.bash.path]
        if (command) spawnArgs.push(command)
        if (containerId) {
          execSync(`docker exec -d ${containerId} /bin/bash
            docker exec -d ${containerId} ln -sf ${config.cli.odbc.path}/sqlcmd /usr/bin
            docker exec -d ${containerId} ln -sf ${config.cli.odbc.path}/bcp /usr/bin`)
          api.log('log', chalk`You are now '{italic root}' in SQL Server container ${containerId}
            {bold.italic bcp} & {bold.italic sqlcmd} are now in the current $PATH. From this prompt, pass
            $MSSQL_SA_PASSWORD as the password when sa is the user named at the prompt.
            Type {bold.italic exit} to close interactive session and resume ${api.roygbv} at host`)
          return resolve(spawnSync(`docker`, spawnArgs, {stdio: [0, 1, 2]}))
        }
      }
      catch(err) {
        reject(err)
      }
    })

  },
  intern: async (instanceId) => {

    try {
      if (await api.isHost()) {
        process.stdout.write(`map SQL Container catalog ${api.getTimestamp()}\n`)
        if (!instanceId) instanceId = await store.pools.getLastInstanceId()
        api.sqlCatalog.Images = new Map()
        api.sqlCatalog.ContainerInfos = new Map()
        api.sqlCatalog.Instance
        api.sqlCatalog.Pools = api.sqlCatalog.Pools || new Map()
        if (await api.internImages()) {
          if (await api.internContainers()) {
            if (!instanceId) {

              // if only one, target it regardless state
              if (api.sqlCatalog.ContainerInfos.size===1) {
                for (let id of api.sqlCatalog.ContainerInfos.keys()) {
                  instanceId=id
                }
              } else {
                // if is only running, target it
                let running=[]
                for (let info of api.sqlCatalog.ContainerInfos) {
                  if (info[1].State==='running') {
                    running.push(info[0])
                  }
                }
                if (running.length===1) {
                  instanceId=running[0]
                }
                // else wait for instructions
              }
            }
          }
          if (api.sqlCatalog.ContainerInfos.has(instanceId)) {
            await api.internInstance(instanceId)
            if (instanceId===api.sqlCatalog.Instance) {
              if (api.sqlCatalog.ContainerInfos.get(instanceId).State==='running') {
                await api.openInstance(instanceId)
              } else {
                api.log('warn', chalk`(intern) Target SQL Container is not 'running', try {italic.bold container start}`)
              }
            } else {
              api.log('warn', `(intern) No SQL Server has been Targeted`)
            }
          }
        }
      } else {
        api.log('warn', chalk`(intern) Docker Container Engine is not 'running', try {italic.bold engine start}`)
      }
    }
    catch(err) {
      api.log('error', err)
    }

  },
  internImages: async () => {

    // will be first place to fail at startup if user not in docker group (must be)
    // sudo usermod -aG docker <username> (might need to logout or reboot?)
    try {
      let images= await docker.listImages()
      for (let image of images) {
        if (image.RepoDigests[0].startsWith(`${config.docker.pull.repo}@`)) {
          api.sqlCatalog.Images.set(image.Id, image)
        }
      }
      return true
    }
    catch(err) {
      if (err.code==='EACCES') {
        api.log('warn', chalk`(internImages) {yellow 'EACESS': user '${process.user}' unauthorized}`)
      }
      return false
    }

  },
  internContainers: async () => {

    // insert order by image id
    try {
      for (let [imageId] of api.sqlCatalog.Images ) {
        let containers = await docker.listContainers({
          "all": true,
          "size": true,
          "filters": { "ancestor": [`${imageId}`] }
        })
        for (let info of containers)  {
          api.sqlCatalog.ContainerInfos.set(info.Id, info)
        }
      }
      return true
    }
    catch(err) {
      api.log('warn', `(internContainers) ended with error\n${err.stack}`)
      return false
    }

  },
  internInstance: (instanceId=api.sqlCatalog.Instance) => {

    try {
      if (api.sqlCatalog.ContainerInfos.has(instanceId)) {
        api.sqlCatalog.Instance = instanceId
        return true
      }
    }
    catch(err) {
      api.log('warn', `(internInstance) ended with error\n${err.stack}`)
      return false
    }

  },
  internPool: (instanceId=api.sqlCatalog.Instance, pool) => {

    try {
      // TODO catalog array of ids and recall from store
      api.sqlCatalog.Pools.set(instanceId, pool)
      store.pools.update(instanceId, pool.config)
      return true
    }
    catch(err) {
      api.log('warn', `(internPool) ended with error\n${err.stack}`)
      return false
    }

  },
  isHost: () => {

    return Promise.resolve( () => {
      try {
        let stats=statSync(config.docker.socket)
        if (stats.isSocket()) {
          return true
        }
      }
      catch(err) {
        if (err.code===`ENOENT`) {
          api.log('warn', chalk`(isHost) Unable to connect to Host's Docker Engine try {italic.bold engine start}`)
        } else if (err.code===`ACCES`) {
          api.log('warn', `(isHost) User not authorized to use Docker socket`)
        } else {
          api.log('warn', `(isHost) ${err.message}`)
          // reject(err)
        }
        return false
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
        return latest
      }).catch( (err) => {
        api.log('error', `(latestInstances) error\n${err.stack}`)
      })

  },
  latestImage: () => {

    for (let image of api.listImage()) {
      if (image.RepoTags) {
        for (let tag of image.RepoTags) {
          // builders known to muck with RepoTags
          if (tag===`${config.docker.pull.repo}:${config.docker.pull.tag}`) {
            return image
          }
        }
      }
    }

  },
  listFiles: async (folder, filter) => {

    return new Promise( function(resolve, reject) {
      try {
        readdir(path.resolve(folder), (err, files) => {
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
  listInstance: (containerId) => {

    let list=[]
    if (api.sqlCatalog.ContainerInfos.size>0) {
      let id, info
      for ([id, info] of api.sqlCatalog.ContainerInfos) {
        if (!containerId || containerId===id) {
          list.push(info)
        }
      }
    }
    return list

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
      // add other message types here and call (could be flakey from server.js)
      if (['confirm', 'debug', 'error', 'info', 'log', 'test', 'warn'].includes(mode)) {
        switch (mode) {
        case ('confirm'):
          process.stdout.write(chalk`{bold.green \u2713}  ${api.format(data)}`)
          break
        case ('debug'):
          if (config.logLevel<=10) {
            process.stdout.write(`{bold.magenta \uffef}  ${api.format(data)}`)
          }
          break
        case ('error'):
          if (typeof data==='object' && data.stack) {
            process.stderr.write(chalk`{bold.red \u274E}  ${data.stack}`)
          } else {
            process.stderr.write(chalk`{bold.red \u274E}  ${api.format(data)}`)
          }
          break
        case ('info'):
          process.stdout.write(chalk`{bold.blue \u2757}  {blue ${api.format(data)}}`)
          break
        case ('log'):
          process.stdout.write(api.format(data))
          break
        case ('test'):
          process.stdout.write(chalk`{bold.magenta \u2B1B}  ${api.format(data)}`)
          break
        case ('warn'):
          process.stdout.write(chalk`{bold.yellow  \u233A }  {yellow ${api.format(data)}}`)
          break
        }
        //process.stdout.write(`\n`)
      }
    }
    catch (e) {
      process.stdout.write(chalk`{bold.red (log)} {bold.red (log) failed\n${e.stack}}\n`)
    }

  },
  mssqlConf: (containerId, confArgs) => {

    // mssql-conf not compiled in RTM image and no make? config.mssql.conf using the .py file it links to...
    new Promise(function(resolve, reject) {
      if (api.sqlCatalog.ContainerInfos.has(containerId)) {
        let options = {
          Cmd: [config.cli.bash.path, '-c', `${config.mssql.conf} ${confArgs}`],
          AttachStdout: true,
          AttachStderr: true
        }
        let container=docker.getContainer(containerId)
        container.exec(options, function(err, exe) {
          if (err) reject(err)
          exe.start(function(err, stream) {
            if (err) reject(err)
            container.modem.demuxStream(stream, process.stdout, process.stderr)
            // return resolve(exec.inspect(() => {})) // empty callback seems to supress output of meta into my stdout
            return resolve(exe.inspect(function(err, data) {
              if (err) reject(err)
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
            Cmd: [config.cli.bash.path, '-c', `ls -lb ${folder}| grep ${filter}`],
            AttachStdout: true,
            AttachStderr: true
          }
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
  openInstance: async (containerId, database='master', user='sa', password) => {

    return new Promise(async (resolve, reject) => {
      try {
        let info = await api.getInstanceInfo(containerId)
        config.mssql.pool.database = database                    // WTF hits tds in options
        config.mssql.pool.port = info.Ports[0].PublicPort        // WTF hits tds in options
        config.mssql.pool.user = user                            // user, pwd, server hits tds as peers of options
        config.mssql.pool.password = user!=='sa'? password: await api.getEnvVariable(containerId, `$MSSQL_SA_PASSWORD`)
        //   The default value for `options.encrypt` will change from `false` to `true`. 
        //   Please pass `false` explicitly if you want to retain current behaviour. 
        //   node_modules/mssql/lib/tedious.js:230:23
        // also have config.pool.encrypt as true but it never gets there either?
        // config.mssql.pool.encrypt = true   this never makes it to 
        // cfg @ node_modules/mssql/lib/tedious.js:230:23 messed with it a while...
        return api.getProcesses()
          .then( async (top) => {
            let sqlBin = await api.getEnvVariable(containerId, `$MSSQL_BIN_DIR`)
            if (top.Processes.length===0 || !top.Processes.join().includes(path.join( sqlBin, `sqlservr`))) {
              reject(new Error(`SQL Server process not detected: Container '${containerId}'`))
            }
            api.internPool(containerId, await require('../lib/sqldb').openPool(config.mssql.pool))
            resolve()
          })
          .catch((err) => {
            api.log('error', `(openInstance) container problem`)
            api.log('error', api.format(err))
            // resolve()
          })
      }
      catch (err) {
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
            api.intern()
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
  renameInstance: async (containerId, name) => {

    if (api.sqlCatalog.ContainerInfos.has(containerId)) {
      await docker.getContainer(containerId).rename(name)
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
  roygbv: chalk`{rgb(255, 0, 0) s}{rgb(255, 136, 0) q}{rgb(255, 255, 0) l}{rgb(0, 255, 0) p}{rgb(0, 0, 255) a}{rgb(153, 0, 153) l}`,
  runImage: async (imageId) => {

    // all get the same shared certificate and backup storage space
    // mountpoint paths are docker createContainer defaults - config for read  and/or write control from inside the containers
    // sym-link access from this app's folder on host must elevate to do most things to/in the root owned docker volumes
    // bwunder@linux-niun:~/sqlpal> docker volume create sqlBackups
    // bwunder@linux-niun:~/sqlpal> ln -s /var/lib/docker/volumes/sqlBackups/_data sqlBackups
    // certificate share
    // ./private - a sym-link in this app's folder on host to root owned docker volumes mounted to all sql containers
    // bwunder@linux-niun:~/sqlpal> docker volume create private
    // bwunder@linux-niun:~/sqlpal> ln -s /var/lib/docker/volumes/private/_data private
    // tls might not even belong here? maybe needs to be on the daemon in the container?
    //   --tls
    //   --tlscacert path.join(config.config.volume.private.target, 'CA-cert.pem'),
    //   --tlscert path.join(config.config.volume.private.target, 'docker-cert.pem'),
    //   --tlskey path.join(config.config.volume.private.target, 'docker-key.pem')
    //   --tlsverify  to use & verify the remote
    return new Promise( async function(resolve, reject) {
      try {
        if (!imageId) {
          reject(new Error('image to run is undeterminable'))
        } else {
          api.log('confirm', `image ${imageId}`)  
          return getPort()
            .then( (hostPort) => {
              let mounts= [
                {
                  Target:   config.volume.sqlBackups.containerPath,
                  Source:   `sqlBackups`,
                  Type:     `volume`,
                  ReadOnly: false
                },
                {
                  Target:   config.volume.private.containerPath,
                  Source:   `private`,
                  Type:     `volume`,
                  ReadOnly: true
                }
              ]
              let enviro = []
              // omit the empties else ka-bloey
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
              return container.start()
            })
            .then( async () => {
              await api.intern()
              api.log('confirm', await store.pools.getLastInstanceId())
            })
        }
      }
      catch (err) {
        reject(err)
      }
    })

  },
  setEngine: (action=`status`) => {

    // does this apply here or in runImage
    // confirm  Docker {
    //   modem:
    //    Modem {
    //      socketPath: '/var/run/docker.sock',
    //      host: undefined,
    //      port: undefined,
    //      version: undefined,
    //      key: undefined,
    //      cert: undefined,
    //      ca: undefined,
    //      timeout: undefined,
    //      checkServerIdentity: undefined,
    //      protocol: 'http',
    //      Promise: [Function: Promise] } }

    return new Promise( async (resolve, reject) => {
      try {
        return api.elevate(`getent group docker`)
          .then( async (group) => {
            if (!group) throw(new Error('(setEngine) docker group not found. Group is created by docker install.'))
            if (!group.includes(process.env.USER)) {
              let addDockerUser = `usermod -aG docker ${process.env.USER}`
              await api.elevate(addDockerUser)
            }
            await api.elevate(`service docker ${action}`)
            resolve(api.intern())
          })
          .catch( (err) => {
            api.log('error', `(elevate) failed\n`)
            reject(err)
          })
      }
      catch(err) {
        reject(err)
      }
    })

  },
  shell: async (containerId, command, tsql) => {

    return new Promise(function(resolve, reject) {
      try {
        api.log('confirm', `(shell) containerId ${containerId}`)
        api.log('confirm', `(shell) command ${command.concat(tsql)}`)
        if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
          if (tsql) command.concat(tsql)
          let cmdArgs = [`exec`, `--interactive`, `--tty`, `${containerId}`].concat(command)
          resolve(spawnSync(`docker`, cmdArgs, {stdio: [0, 1, 2]}))
        }
      }
      catch(err) {
        reject(err)
      }
    })

  },
  sqlCatalog: {},
  startInstance: async (containerId=api.sqlCatalog.Instance) => {

    if (api.sqlCatalog.ContainerInfos.get(containerId).State!=='running') {
      api.log('confirm', `(startInstance) ${containerId}...`)
      return docker.getContainer(containerId).start()
        .then( async () => {
          api.log('confirm', `(startInstance) tail sql container log...`)
          await api.tailLog(containerId)
        })
        .then( async () => {
          await api.intern()
          api.log('confirm', `(startInstance) started ${containerId}`)
        })
        .catch( (err) => {
          api.log('warn', `(startInstance) malfunction`)
          api.log('error', err)
        })
    } else {
      api.log('warn', chalk`(startInstance) ${containerId} is already running, try {italic.bold container --restart} ?`)
    }

  },
  stopInstance: async (containerId=api.sqlCatalog.Instance) => {

    if (containerId && api.sqlCatalog.ContainerInfos.has(containerId)) {
      if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
        api.log('confirm', `(stopInstance) ${containerId}...`)
        return docker.getContainer(containerId).stop()
          .then( async () => {
            await api.intern(api.sqlCatalog.Instance)
          })
      }
    }

  },
  startSQLPad: async () => {

    try {
      let sqlpadArgs = []
      let dir = path.resolve(config.sqlpad.dir)
      return api.genCertificate('sqlpad', config.sqlpad["cert-password"])
        .then( async () => {
          api.sqlpad = spawn('sqlpad', sqlpadArgs)
          if (!existsSync(dir)) mkdirSync(dir)
          await api.elevate(`cp ${path.resolve('private/sqlpad-key.pem')} ${dir}`)
          await api.elevate(`cp ${path.resolve('private/sqlpad-cert.pem')} ${dir}`)
          await api.elevate(`chown ${process.env.USER} ${path.resolve(dir, 'sqlpad-key.pem')} `)
          await api.elevate(`chown ${process.env.USER} ${path.resolve(dir, 'sqlpad-cert.pem')}`)
          // await api.elevate(`chmod a+x ${path.resolve(dir, 'sqlpad-key.pem')} `)
          // await api.elevate(`chmod a+x ${path.resolve(dir, 'sqlpad-cert.pem')}`)
          config.sqlpad["cert-passphrase"] = config.sqlpad["cert-password"]
          config.sqlpad["key-path"] = `${path.join(dir, 'sqlpad-key.pem')}`
          config.sqlpad["cert-path"] = `${path.join(dir, 'sqlpad-cert.pem')}`
          Object.keys(config.sqlpad).forEach( (key) => {
            if (config.sqlpad[key]) {
              sqlpadArgs.push( key.length==1? `-${key}`: `--${key}` )
              sqlpadArgs.push( config.sqlpad[key])
            }
          })
          api.sqlpad.on('error',  (err) => {
            api.log('error', chalk`{cyan.italic.bold (sqlpad)} {red error}`)
            api.log('error', err)
          })
          api.sqlpad.stdout.on('data', (data) => {
            if (/Welcome/.test(data)) {
              api.log('log', chalk.cyan.italic(data))
              api.log('info', chalk`{italic.bold (sqlpad)} {yellow use a browser wih V8 - i.e., Chrome or Chromium}`)
            } else {
              if (config.sqlpad.debug) {
                api.log('debug', chalk`{cyan.italic (sqlpad)} {gray ${data}}`)
              }
            }
          })
          api.sqlpad.stderr.on('data', (err) => {
            api.log('log', chalk`{cyan.italic (sqlpad)}  {red error}\n${err}`)
          })
          api.sqlpad.on('exit', code => {
            api.log('warn', chalk`{cyan.italic (sqlpad)} {gray server has exited} code: ${code}`)
            api.sqlpad=undefined
          })
        })
        .catch( e => {
          api.log('error', `(startSQLPad) TLS secure sequence promise error`)
          api.log('error', e)
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
        let logStream = new PassThrough()
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
            case (data.includes('Recovery is complete.')):
              stream.emit('end')
              break
            case (infoOnly && data.includes('informational message only')):
              api.log('log', data)
              break
            case (/error\./i.test(data)):
              api.log('error', chalk.red`${data}`)
              break
            case (!infoOnly):
              api.log('log', data)
              break
            default:
              break
            }
          })
          stream.on('end', function(){
            resolve()
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
  writeResults: async (outFile, output) => {

    return new Promise(async function(resolve, reject) {
      writeFile(outFile, api.format(output), (err) => {
        if (err) {
          api.log('error', `(archiveQueries) writeFile error ${textFile}`)
          reject(err)
        }
        resolve()
      })
    })
  
  }
  
}
