////NPM
const chalk = require('chalk')
const { edit } = require('external-editor')
////core
const { exec, spawn, spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')
////local
const catalog = require('../lib/catalog')
const { format, log } = require('../lib/log')
const store = require('../lib/store')
const sqldb = require('../lib/sqldb')
const { isSigned, listHostIP4s, genCertificate } = require('./tls')

const config = require('../config/config.json')
const { name, description, version } = require('../package.json')

const cliOptions = []

const shelevate = async bashCommand => { 

  return new Promise( async (resolve, reject) => {
    try {
      if (config.cli.log.elevations) {
        log('log', chalk`{bold.yellow ${"\u{1F934}"}}  {magenta ${bashCommand}}`)
      }
      exec(`sudo ${bashCommand}`, (err, stdout, messages) => {
        if (err) {
          if (err.code) {
            resolve(log('error', `(shelevate) callback error ${err}`))
            exec(`sudo systemctl  status docker.service`, (err, stdout, messages) => {
              if (err) log('error', 'err')
              log('log', `stdout ${stdout}`)          
              log('log', `messages ${messages}`)          
            })
          } else {
          // hot potato
            reject(new Error(`(shelevate) subprocess returned an exception:\n${err}`))
          }
        }
        // from subprocess io stream
        if (messages) resolve(log('confirm', `(shelevate) ${messages}`))
        resolve(stdout.trim())
      })
    }
    catch(er) {
      exec(`sudo systemctl  status docker.service`, (err, stdout, messages) => {
        if (err) log('error', 'err')
        log('log', `stdout ${stdout}`)          
        log('log', `messages ${messages}`)          
        reject(er)
      })
    }  
  })

}

module.exports = api = {

  addFile: async textFile => {

    return new Promise(async (resolve, reject) => {
      //s open editor with blank page  
      let text = await api.editText('')
      fs.writeFile(textFile, text, err => {
        if (err) {
          log('error', `(addFile) writeFile error ${textFile}`)
          reject(err)
        }
        resolve()
      })
    })

  },
  archiveQueries: async textFile => {

    return new Promise(async (resolve, reject) => {
      let collection = await store.templates.extract()
      let obj = "module.exports = {\n"
      for (let qry of collection) {
        obj += `${qry.name}: \u0060${qry.text}\u0060,\n` 
      }
      obj += '}'
      fs.writeFile(textFile, obj, 'utf8', err => {
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
        /* see https://docs.catalog.com/engine/security/https/#other-modes 
          Daemon modes
            tlsverify, tlscacert, tlscert, tlskey - Authenticate clients
            tls, tlscert, tlskey - Do not authenticate clients
          Client modes 
            tls: Authenticate server based on public/default CA pool
            tlsverify, tlscacert - Authenticate server based on given CA
            tls, tlscert, tlskey - Authenticate with client certificate, do not authenticate server based on given CA
            tlsverify, tlscacert, tlscert, tlskey - Authenticate with client certificate and authenticate server based on given CA
            if serverAuth only (e.g., https) 
              cliOptions: --tls -H tcp://<PublicIP>:2376 ps
              apiOptions: { tls: true, host: <publicIP> }
              daemonOptions: { tls: true, tlscacert: caCert, tlscert: serverCert, tlskey: serverKey}
            if clientAuth+ServerAuth (eg, Docker API, Docker CLI) 
              cliOptions: --tlsverify --tlscacert /<path>/CA-cert.pem --tlscert /<path>/dockerCLI-cert.pem --tlskey /<path>/dockerCLI-key.pem -H tcp://192.168.0.105:2376 ps
              apiOptions: { tls: true, tlscacert: caCert(), tlscert: clientCert(), tlskey: clientKey(), host }
              daemonOptions: { tls: true, tlscacert: caCert, tlscert: serverCert, tlskey: serverKey}
        */
        // we need to pass the cliOptions to child procs
        cliOptions.splice(0)
        let daemonOptions = {}
        let apiOptions = {} 
        let daemonjson = path.resolve(config.docker.bindings.private.mount.Source, 'daemon.json') 
        let caCert = path.resolve(config.docker.bindings.private.mount.Source, config.cli.ca.cert)
        let running =[] 
        let serverCert = path.resolve(config.docker.bindings.private.mount.Source, config.docker.daemon.cert)
        let serverKey = path.resolve(config.docker.bindings.private.mount.Source, config.docker.daemon.key)
        let clientCert = path.resolve(config.docker.bindings.private.mount.Source, config.docker.api.cert)
        let clientKey = path.resolve(config.docker.bindings.private.mount.Source, config.docker.api.key)
        if (await shelevate(`ls /etc/docker/daemon.json`)===`/etc/docker/daemon.json`) {
          await shelevate(`cp --force /etc/docker/daemon.json ${daemonjson}`)  
            if (fs.statSync(daemonjson).uid!==process.getuid()) {
              await shelevate(`chown ${process.env.USER} ${daemonjson} `)
              fs.chmodSync(daemonjson, 755)
              daemonOptions = await api.fileToJSON(daemonjson)  
            }
          }
        if (!config.docker.daemon.tls) {
          if (daemonOptions.tls) {
            log('warn', chalk`(attachDocker) {bold.yellow dockerd TLS is de-escalated} engine stop/start required`) 
            delete daemonOptions.tls
          }    
          if (daemonOptions.tlsverify) delete daemonOptions.tlsverify  
          if (daemonOptions.tlscacert) delete daemonOptions.tlscacert  
          if (daemonOptions.tlscert) delete daemonOptions.tlscert  
          if (daemonOptions.tlskey) delete daemonOptions.tlskey  
          apiOptions.port = 2375 // 2375 by convention, I do not recommend you move this one
          apiOptions.protocol = 'http'
        } else { //use tls 
          if (!fs.existsSync(serverCert)) await genCertificate('docker', 'serverAuth', config.docker.daemon.password)
          if (!await isSigned(serverCert)) reject(new Error(`(attachDocker) dockerd certificate not signed by me\n${serverCert}`))
          daemonOptions.tls = config.docker.daemon.tls
          daemonOptions.tlscacert = caCert
          daemonOptions.tlscert = serverCert
          daemonOptions.tlskey = serverKey
          apiOptions.port = 2376 // 2376 by convention, but can be changed or set with getPort()  
          apiOptions.protocol = 'https'

          cliOptions.push(`--tls`)

          apiOptions.ca = fs.readFileSync(caCert)
          if (!config.docker.daemon.tlsverify) {
            if (daemonOptions.tlsverify) {
              log('warn', chalk`(dockerAttach) {bold.yellow dockerd TLSVERIFY 'clientAuth' de-escalation}`) 
              delete daemonOptions.tlsverify
            }
          } else {
            if (!fs.existsSync(clientCert)) await genCertificate('dockerCLI', 'clientAuth', config.docker.api.password)
            if (!await isSigned(clientCert)) reject(new Error(`(attachDocker) dockerCLI certificate not signed by me\n${clientCert}`))
            daemonOptions.tlsverify=config.docker.daemon.tlsverify
            apiOptions.cert = fs.readFileSync(clientCert)
            apiOptions.key = fs.readFileSync(clientKey)
            cliOptions.push(`--tlsverify`)
            cliOptions.push(`--tlscacert ${caCert}`) 
            cliOptions.push(`--tlscert ${clientCert}`)
            cliOptions.push(`--tlskey ${clientKey}`)
          }
        }                 
        daemonOptions.hosts = []
        for (let IP4 of await listHostIP4s()) {
          if (!apiOptions.host) apiOptions.host = IP4
          cliOptions.push(`-H tcp://${IP4}:${apiOptions.port}`)
          daemonOptions.hosts.push(`tcp://${IP4}:${apiOptions.port}`)
        }
        await api.jsonToFile(JSON.stringify(daemonOptions, null, 2), daemonjson) 
        if (config.cli.log.debug) {
          await api.jsonToFile(JSON.stringify(cliOptions, null, 2), 
                           path.resolve(config.docker.bindings.private.mount.Source, 
                            'dockerCLI.json'))
                           }                    
        if ((await shelevate(`diff ${daemonjson} /etc/docker/daemon.json`)!=='')) {
          await shelevate(`cp ${daemonjson} /etc/docker/daemon.json`)
//??? maybe better if this prompted to continue??? 
          log('warn', chalk`(attachDocker) {bold.yellow restart dockerd - TLS changes detected.}`) 
          let running = catalog.listInstanceIds('up')
          if (await catalog.isHost()) {
            await api.setEngine('stop')
          }
          await api.setEngine('start')
        }    
        catalog.setDockerRemoteAPI(apiOptions)
        for (containerId of running) {
          await catalog.startInstance(containerId)
        }
        resolve(true)
      }
      catch(err) {
        log('error', err)
        reject(err)  
      }  
    })

  },
  bandAid: () => {
    return chalk`{bold ${name}  {blue \u2638}  v. ${version}}`
  },
  batch: [''],
  checkNPM: async () => {

    return new Promise( (resolve, reject) => {
      exec(`npm outdated`, {}, (err, result) => {
        if (err) {
          resolve(err.message)
        }  
        store.npm.put(result)
        resolve(result|| 'up to date')
      })
    })

  },
  cliAid: () => {

    let tab = chalk.bold(`\u276F`)
    return chalk`
    {bold ${api.bandAid()}}\n
      ${description}\n
    USAGE: 
    [ {bold t-sql...} | [[{bold command}|startsWith${tab}]${tab}${tab}  [{bold --}[{bold option}|startsWith${tab}]${tab}${tab}][ ...]  [[{bold argument}|startsWith${tab}]${tab}${tab}][ ...] ]

      Tab Autocomplete for all CLI commands 
        Complete/preview mechanics consistent across all commands, command arguments & command options.
        One TAB (${tab}) autocompletes when exactly one match found.
        Two (more) TABs (${tab}${tab}) previews all possible completions for what, if anything, has been typed.
        Completion is more likely the more characters typed. Usually, two characters are sufficient. 
        For TSQL autocomplete, use the IDE

      Help for all CLI commands 
        {bold ${'help [command]'.padEnd(30)}}  Command usage else a descriptive index of all commands when no command arg.
        {bold ${'[command] --help'.padEnd(30)}}  Command usage else CLI usage when no command - see also {bold about}).

      Commonly needed next Container Management API commands at startup:
        {bold ${'engine start'.padEnd(30)}}  Start the Docker Container Engine Instance
        {bold ${'container start'.padEnd(30)}}  Start an existing SQL Server Instance
        {bold ${'catalog'.padEnd(30)}}  Review the Inventory of local SQL Server Images and Containers
        {bold ${'image pull'.padEnd(30)}}  Fetch '${config.docker.pull.repo}:latest' from dockerhub
        {bold ${'image run'.padEnd(30)}}  Instantiate SQL Server instance from a local image
        {bold ${'container target'.padEnd(30)}}  Target CLI queries at an existing SQL Server Container
        -- or --
        ${'<your t-sql query>'.padEnd(30)}  Enter a valid TSQL query  
        {bold ${'query'.padEnd(30)}}  Load a TSQL query from nedb on host to CLI Batch cache 
        {bold ${'script'.padEnd(30)}}  Load a TSQL script from ${config.cli.scripts.path} folder to CLI Batch cache
          and then use {bold go,  run,  sqlcmd,} or {bold stream} to Submit Batch cache to Target SQL Server\n`
  },
  cliOptions: [],
  commandAid: (cmds) => {

    let tab = chalk.bold(`\u276F`)
    let term=[]
    cmds.forEach( cmd => {
      switch(true) {
      case(['go', 'run', 'sqlcmd', 'issql'].includes(cmd._name.toLowerCase())):
        term.push(`${chalk.rgb(255, 255, 0)(cmd._name).padEnd(25)}\t${cmd._description}`)
        break
      default:
        break
      }
    })
    return [chalk`
    {bold ${api.bandAid()}}\n
      ${description}\n

        * Manage and secure the Docker Container Engine systemd daemon (dockerd)
        * Source and deploy Official SQL Server Docker Images from https://dockerhub.com
        * Create and use as many Contained SQL Server for Linux instances as needed 
        * Emulate distributed or cloud data apps on one local compute instance
        * Comingle any assortment of SQL and NoSQL data stores
        * Edit and reuse CLI stored scripts and queries targeting the anonym's data stores

      Input at the cli prompt is processed on enter. Either a CLI command is recognized or the text is 
      appended to an edit-able buffer cache as text. This {bold Batch} cache anticipates that the input 
      is valid TSQL. Any time the user is uncertain that is true, the {bold Batch} cache can be parsed by a SQL Server 
      query engine with the {bold issql} command. {bold issql} is non-destructive to the cache. 
      Other than chewing up a few CPU cycles as the query engine parses the text and returns messages. Nothing 
      in the cache or the database is changed. 
      
      Cached TSQL can be cleared from cache with {bold batch reset} - or, using autocomplete and the '?' 
      alias for the Batch command - the same command to clear the {bold Batch} cache can be entered as {bold ? r${tab}}.  
      When {rgb(255, 255, 0) Terminating} commands discussed below are entered, the {bold Batch} cache is compiled to one 
      query string per delimited SQL Batch and submitted for execution by the targeted SQL Server. 
      
      After any successful execution, query execution is logged and the cache is truncated and ready for input. 
      
      Errors returned from the database will display the error and hold the query in cache for user disposition.  
      
      Valid CLI Commands can be entered at any new line, regardless if the {bold Batch} cache holds text*. Commands that 
      do not use the cache don't mess with cache content. Only {bold query}, {bold script}, the terminating commands 
      and the {bold batch} command use and affect the {bold Batch} cache.
      
      ${chalk.underline.rgb(255, 255, 0)(`Terminating commands`)} submit the {bold Batch} to Query Engine of Target SQL Server
      ${term.join('\n\t')}

      All CLI commands and options - including {bold go} & {bold use} of particulare note - are lower case and case 
      sensitive. All UPPERCASE or MixedCase text goes into the {bold Batch} cache.
      
      Only the {bold run} or {bold sqlcmd} commands can process a batch that includes upper or mixed case 'GO' or 
      'Use' directives - that, while generally thought of as TSQL, are always client side preprocessed. 
      
      When the Batch is submitted, by default the {bold issql} check is first submitted to help mitigate 
      query failure resulting in corruption. Permissions or Invalid object references can still result in mid-script 
      faults that can corrupt data sets, so caution during query development and testing is vital. The pre-test 
      roundtrip can be toggled true or false in config.json (config.cli.alwaysCheckSyntax) 

      Command index: {bold help} alias (no dashes) 
      Usage: {bold about quickstart} or, using autocomplete, {bold a${tab} q${tab}} for to get
      started or find more about autocomplete. 

      *Should the first word of a valid TSQL line conflict with a command name, the command has precedence and 
      will be invoked when the line is entered. While I have only imagined this could happen and have not had 
      this experience, to work around the restriction, I suggest in the rare instance it might happen to write 
      the query using {bold batch edit} or re-style the TSQL to avoid the start of line conflict.           
    `]
  },
  compile: metadata => {

    let str = ''
    if (!metadata) { // no passed arg use, cache
      str= api.batch.join('\n')
    } else if (!Array.isArray(metadata)) { // from object arg
      Object.keys(metadata).forEach( key => {
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
  delimiter: `${name} >`,
  developFile: async textFile => {

    log('log', `opening '${textFile}' in '${config.cli.ide}'`)
    if (!textFile.endsWith('sql')) {
      log('log', `Saved changes may not be recognized until ${api.name} is restarted`)
    }
    // leave IDE alone at shutdown, even if this opens it
    spawn(config.cli.ide, [path.resolve(textFile)])

  },
  editFile: async textFile => {

    // works with emacs, kwrite and vim but atom-beta can't seem to find the temp file xedit uses
    return new Promise( async (resolve, reject) => {
      try {
        let text = await api.fileToJSON(textFile)
        let newtext = await api.editText(text)
        if (text!==newtext) {
          fs.writeFileSync(textFile, newtext)
        } 
        resolve()
      }
      catch(err) {
        reject(err)
      }
    })

  },
  editText: async text => {

    // v, vim or Emacs for editing batch, Atom, code better (developeFile) for source files, can never remember how to use vim
    // Azure STudio or the earlier SQLOps alpha do not accept text (or file) arg at the command-line, VS code accepts file but not text
    return new Promise( (resolve, reject) => {
      try {
        if (!config.cli.editor) {
          log('warn', `config.cli.editor undefined`)
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
  fileToBatch: async scriptFile => {

    return new Promise( (resolve, reject) => {
      try {
        fs.readFile(scriptFile, 'utf8', (err, script) => {
          if (err) reject(err)
          if (!script) {
            log('error', `No script ${scriptFile}`)
          } else {
            api.batch.splice(0)
            api.batch.push(`-- ${scriptFile}`)
            for (let line of script.split('\n')) {
              api.batch.push(line)
            }
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
        fs.readFile(path.resolve(fromFile), 'utf8', (err, data) => {
          if (err) reject(err)
          resolve(data)          
        })
      }
      catch(err) {
        reject(err)
      }
    })

  },
  getPool: instanceId => {

    catalog.sql.Pools.get(instanceId)

  },
  getTimestamp: () => { 
    // a valid string with no white space for file names
    return new Date().toISOString().replace(':','_')

  },
  interactiveShell: (containerId, command) => {

    return new Promise(function(resolve, reject) {
      try {
        // concat then split to replace new lines with spaces else spawnSync barfs 
        let spawnArgs = cliOptions.join(' ').split(' ').concat([`exec`, `--interactive`, `--tty`, `${containerId}`, config.cli.bash.path])
        if (command) spawnArgs.push(command)
        if (containerId) {
          log('log', chalk`Connecting (as 'root'!) to SQL Server container ${containerId}
            {bold bcp} & {bold sqlcmd} are now in the current $PATH. 
            From this prompt, env var can be used with either tool to connect as as 'sa':
              sqlcmd -U sa -P $MSSQL_SA_PASSWORD -Q'select @@SERVERNAME'
            Type {bold exit} to close container shell and resume the ${name} event loop.`)
          return resolve(spawnSync(`docker`, spawnArgs, {stdio: [0, 1, 2]}))
        }
      }
      catch(err) {
        reject(err)
      }
    })

  },
  jsonToFile: async (obj, toFile) => {

    fs.writeFileSync(path.resolve(toFile), obj, 'utf8')

  },
  listDatabases: async () => {

    let databases = []
    let results = await sqldb.query('select name from sysdatabases', catalog.sql.Instance)
    for (let db of results.recordset) {
      databases.push(db.name)
    }
    return databases

  },
  listFiles: async (folder, filter) => {

    return new Promise( async (resolve, reject) => {
      try {
        let list=[]
        let files = fs.readdirSync(path.resolve(folder)) 
        files.forEach( fileName => {
          if (fileName.includes(filter)) {
            list.push(fileName)
          }
        })
        resolve(list.sort())
      }
      catch(err) {
        reject(err)
      }
    })

  },
  mssqlConf: (containerId, confArgs) => {

    // mssql-conf not compiled in RTM image and no make, so try the .py file 
    new Promise( async (resolve, reject) => {
      if (catalog.sql.ContainerInfos.has(containerId)) {
        let options = {
          Cmd: [config.cli.bash.path, '-c', `${config.mssql.conf} ${confArgs}`],
          AttachStdout: true,
          AttachStderr: true
        }
        let container= await catalog.getDAPIContainer(containerId)
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
  mssqlFiles: (containerId=catalog.sql.Instance, folder, filter) => {

    return new Promise( async (resolve, reject) => {
      try{
        log('log', chalk.gray(`\tcontainerId: ${containerId} \n\tfolder: ${folder} \n\tfilter: ${filter}`) )
        // if (!containerId) containerId = catalog.sql.Instance
        if (catalog.sql.ContainerInfos.get(containerId).State=='running') {
          let options = {
            Cmd: [config.cli.bash.path, '-c', `ls -lb ${folder} | grep ${filter}`],
            AttachStdout: true,
            AttachStderr: true
          }
          let container = await getContainer(containerId)
          let exec = await container.exec(options)
          exec.start( (err, stream) => {
            if (err) reject(err)
            container.modem.demuxStream(stream, process.stdout, process.stderr)
            stream.on('end', () => {
              resolve()
            })
            stream.on('error', err => {
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
  openInstance: async (containerId, database, user, password) => {

    return new Promise( async (resolve, reject) => {
      try {
        let info = await catalog.getInstanceInfo(containerId)
        let poolConfig=await store.pools.get(containerId)
        //passed has precidence, passing undefined opens users default db
        config.mssql.pool.database = database || (!poolConfig)? undefined: poolConfig.database                    
        config.mssql.pool.port = info.Ports[0].PublicPort        
        config.mssql.pool.user = user || config.mssql.pool.user
        config.mssql.pool.password = config.mssql.pool.user!=='sa'? password: await catalog.getEnvVariable(containerId, `$MSSQL_SA_PASSWORD`)
        return catalog.getProcesses(containerId)
          .then( async (top) => {
            if (top) {
              let sqlBin = await catalog.getEnvVariable(containerId, `$MSSQL_BIN_DIR`)
              if (top.Processes.length===0 || !top.Processes.join().includes(path.join( sqlBin, `sqlservr`))) {
                reject(new Error(`SQL Server process not detected: Container '${containerId}'`))
              }
              await sqldb.openPool(containerId, config.mssql.pool) // db in config may be set/changed in call
              catalog.internPool(containerId, config.mssql.pool) // and will be persisted making app sticky to last opened
            }    
            resolve(true)
          })
          .catch(err => {
            log('error', `(openInstance) ${err}`)
            resolve(false)
          })
      }
      catch (err) {
        reject(err)
      }
    })

  },
  restoreScript: async scriptName => {

    fs.writeFileSync(scriptName, await store.scripts.get(scriptName))

  },
  setEngine: (action=`status`) => {

    return new Promise( async (resolve, reject) => {
      try {
        return shelevate(`getent group docker`)
          .then( async group => {
            if (!group) throw(new Error('(setEngine) docker group not found'))
            if (!group.includes(process.env.USER)) {
              log('info', await shelevate(`usermod -aG docker ${process.env.USER}`))
            }
            if (action==='status') {
              resolve( await shelevate(`systemctl status dockerd`))
            } else {
              await shelevate(`service docker ${action}`)
              if (await catalog.intern()) {
                api.openInstance(catalog.sql.Instance)
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
  shell: async (containerId, command, tsql) => {
    
    return new Promise( async (resolve, reject) => {
      try {
        let container = await catalog.getDAPIContainer(containerId)           
        if (container.State==='running') {
          if (tsql) command.concat(tsql)
          let options = {
            "AttachStdin": true,
            "AttachStdout": true,
            "AttachStderr": true,
            "Tty": true,
            "Cmd": ['bash', command],
            "Env": [],
            "Privileged ": false,
            "User": process.user,
            "WorkingDir": config.cli.odbc.path
          }
          container.exec(options, (err, exec) => { // Exec { modem: Modem;{...}}, id: id } 
            if (err) reject(err)
            exec.start( (err, stream) => {
              if (err) reject(err)
              resolve(container.modem.demuxStream(stream, process.stdout, process.stderr))
            })
          })
        }
      }
      catch(err) {
        reject(err)
      }
    })

  },
  writeResults: async (outfile, data) => {

    return new Promise( (resolve, reject) => {
      try {
        fs.writeFile(path.resolve(outfile), JSON.stringify(data, null, 2), err => {
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
