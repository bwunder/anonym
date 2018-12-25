////NPM
const Docker = require('dockerode')
const chalk = require('chalk')
const { edit } = require('external-editor')
const getPort = require('get-port')
const { createCertificate, createCSR, createPrivateKey, verifySigningChain } = require('pem')
////core
const { PassThrough } = require('stream')
const { exec, execSync, ref, spawn, spawnSync, unref } = require('child_process')
const fs = require('fs')
const { hostname, networkInterfaces } = require('os')
const path = require('path')
const { inspect } = require('util')
////local
const store = require('../lib/store')

const config = require('../config/config.json')
const sqlpad = require('../config/sqlpad.json')
const { name, description, version } = require('../package.json')

// not for distribution, but may be better to upsert to nedb in attachDocker or make it a symbol
const dockerCLIOptions = []

//var api // kludge to shut eslint up if you want to grab exports now too
module.exports = api = {

  addFile: async (textFile) => {

    return new Promise(async (resolve, reject) => {
      //s open editor with blank page  
      let text = await api.editText('')
      fs.writeFile(textFile, text, err => {
        if (err) {
          api.log('error', `(addFile) writeFile error ${textFile}`)
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
          api.log('error', `(archiveQueries) writeFile error ${textFile}`)
          reject(err)
        }
        return resolve()
      })
    })

  },
  attachDocker: async () => {

    return new Promise( async (resolve, reject) => {
      /* see https://docs.docker.com/engine/security/https/#other-modes 
        Daemon modes
          tlsverify, tlscacert, tlscert, tlskey - Authenticate clients
          tls, tlscert, tlskey - Do not authenticate clients
        Client modes 
          tls: Authenticate server based on public/default CA pool
          tlsverify, tlscacert - Authenticate server based on given CA
          tls, tlscert, tlskey - Authenticate with client certificate, do not authenticate server based on given CA
          tlsverify, tlscacert, tlscert, tlskey - Authenticate with client certificate and authenticate server based on given CA
         - abandon default socket, use tcp socket to cover public facing side of host port with tls 
          if serverAuth only (e.g., https) 
            cliOptions: --tls -H tcp://<PublicIP>:2376 ps
            apiOptions: { tls: true, host: <publicIP> }
            daemonOptions: { tls: true, tlscacert: caCert, tlscert: serverCert, tlskey: serverKey}
          if clientAuth+ServerAuth (eg, Docker API, Docker CLI) 
            cliOptions: --tlsverify --tlscacert /<path>/CA-cert.pem --tlscert /<path>/dockerCLI-cert.pem --tlskey /<path>/dockerCLI-key.pem -H tcp://192.168.0.105:2376 ps
            apiOptions: { tls: true, tlscacert: caCert(), tlscert: clientCert(), tlskey: clientKey(), host }
            daemonOptions: { tls: true, tlscacert: caCert, tlscert: serverCert, tlskey: serverKey}
      */
      dockerCLIOptions.splice(0)
      let daemonOptions = {}
      let apiOptions = {} 
      let daemonjson = path.resolve(config.docker.bindings.private.mount.Source, 'daemon.json') 
      let caCert = path.resolve(config.docker.bindings.private.mount.Source, config.cli.ca.cert)
      let serverCert = path.resolve(config.docker.bindings.private.mount.Source, config.docker.daemon.cert)
      let serverKey = path.resolve(config.docker.bindings.private.mount.Source, config.docker.daemon.key)
      let clientCert = path.resolve(config.docker.bindings.private.mount.Source, config.docker.api.cert)
      let clientKey = path.resolve(config.docker.bindings.private.mount.Source, config.docker.api.key)
      if (!await api.isHost())
        if (await api.shelevate(`ls /etc/docker/daemon.json`)===`/etc/docker/daemon.json`) {
          await api.shelevate(`cp --force /etc/docker/daemon.json ${daemonjson}`)  
          if (fs.statSync(daemonjson).uid!==process.getuid()) {
            await api.shelevate(`chown ${process.env.USER} ${daemonjson} `)
            fs.chmodSync(daemonjson, 755)
            daemonOptions = await api.fileToJSON(daemonjson)  
          }
        }
      if (!config.docker.daemon.tls) {
        if (daemonOptions.tls) {
          api.log('warn', chalk`(dockerAttach) {bold.yellow dockerd TLS is de-escalated} engine stop/start required`) 
          delete daemonOptions.tls
        }    
        if (daemonOptions.tlsverify) delete daemonOptions.tlsverify  
        if (daemonOptions.tlscacert) delete daemonOptions.tlscacert  
        if (daemonOptions.tlscert) delete daemonOptions.tlscert  
        if (daemonOptions.tlskey) delete daemonOptions.tlskey  
        apiOptions.port = 2375
        apiOptions.protocol = 'http'
      } else { //use tls 
        if (!fs.existsSync(serverCert)) await api.genCertificate('docker', 'serverAuth', config.docker.daemon.password)
        if (!await api.isSigned(serverCert)) reject(new Error(`(dockerAttach) dockerd certificate not signed by me\n${serverCert}`))
        daemonOptions.tls = config.docker.daemon.tls
        daemonOptions.tlscacert = caCert
        daemonOptions.tlscert = serverCert
        daemonOptions.tlskey = serverKey
        apiOptions.port = 2376
        apiOptions.protocol = 'https'
        dockerCLIOptions.push(`--tls`)
        apiOptions.ca = fs.readFileSync(caCert)
        if (!config.docker.daemon.tlsverify) {
          // apiOptions.cert = fs.readFileSync(serverCert)
          // apiOptions.key = fs.readFileSync(serverKey)
          if (daemonOptions.tlsverify) {
            api.log('warn', chalk`(dockerAttach) {bold.yellow dockerd TLSVERIFY 'clientAuth' de-escalation}`) 
            delete daemonOptions.tlsverify
          }
        } else {
          if (!fs.existsSync(clientCert)) await api.genCertificate('dockerCLI', 'clientAuth', config.docker.api.password)
          if (!await api.isSigned(clientCert)) reject(new Error(`(dockerAttach) dockerCLI certificate not signed by me\n${clientCert}`))
          daemonOptions.tlsverify=config.docker.daemon.tlsverify
          apiOptions.cert = fs.readFileSync(clientCert)
          apiOptions.key = fs.readFileSync(clientKey)
          dockerCLIOptions.push(`--tlsverify`)
          dockerCLIOptions.push(`--tlscacert ${caCert}`) 
          dockerCLIOptions.push(`--tlscert ${clientCert}`)
          dockerCLIOptions.push(`--tlskey ${clientKey}`)
        } 
      }                 
      daemonOptions.hosts = []
      for (let IP4 of await api.listHostIP4s()) {
        if (!apiOptions.host) apiOptions.host = IP4
        dockerCLIOptions.push(`-H tcp://${IP4}:${apiOptions.port}`)
        daemonOptions.hosts.push(`tcp://${IP4}:${apiOptions.port}`)
      }
      await api.JSONtoFile(JSON.stringify(daemonOptions, null, 2), daemonjson) 
      await api.JSONtoFile(JSON.stringify(apiOptions, null, 2), 
        path.resolve(config.docker.bindings.private.mount.Source, 'dockerAPI.json')) 
      await api.JSONtoFile(JSON.stringify(dockerCLIOptions, null, 2), 
        path.resolve(config.docker.bindings.private.mount.Source, 'dockerCLI.json')) 
      if ((await api.shelevate(`diff ${daemonjson} /etc/docker/daemon.json`)!=='')) {
        await api.shelevate(`cp ${daemonjson} /etc/docker/daemon.json`)
        api.log('warn', chalk`(dockerAttach) {bold.yellow dockerd TLS configuration is changed.}
          Docker daemon is stopping then starting to effect this change. A plain vanilla restart will not
          move the httpd socket type or change the Socker API protocol. Stopping the daemon stops running 
          SQL Server Containers and then {bold ${name}} restarts those Containers.`) 
        let running = api.listInstanceIds('up')
        await api.setEngine('stop')   
        api.log('confirm', `running b4 stop/start ${running}`)
        await api.setEngine('start')
        for (containerId of running) {
          await api.startInstance(containerId)
        }
      } 
      api.docker = new Docker(apiOptions)
      resolve(true)
    })

  },  
  bandAid: () => {
    return chalk`{bold ${api.name}  {blue \u2316}  v. ${version}}`
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
    return chalk`\n\n{bold ${api.bandAid()}}
      ${description}\n\n
    USAGE: 
    [ {bold t-sql...} | [[{bold command}|startsWith${tab}]${tab}${tab}  [{bold --}[{bold option}|startsWith${tab}]${tab}${tab}][ ...]  [[{bold argument}|startsWith${tab}]${tab}${tab}][ ...] ]

      Tab Style Autocomplete for all CLI commands 
        Complete/preview mechanics consistent across all commands, command arguments & command options.
        One TAB (${tab}) autocompletes when exactly one match found.
        Two (more) TABs (${tab}${tab}) previews all possible completions for what, if anything, has been typed.
        Completion is more likely the more characters typed. Usually, two characters are sufficient. 

      Help for all CLI commands 
        {bold ${'help [command]'.padEnd(30)}}  Command usage else a descriptive index of all commands when no command arg.
        {bold ${'[command] --help'.padEnd(30)}}  Command usage else CLI usage when no command (same as {bold about}, see also {bold about cli}).

      Commonly needed next commands at startup:
        {bold ${'engine start'.padEnd(30)}}  Start the Docker Container Engine Instance
        {bold ${'container start'.padEnd(30)}}  Start an existing SQL Server Instance
        {bold ${'catalog'.padEnd(30)}}  Review the Inventory of local SQL Server Images and Containers
        {bold ${'image pull'.padEnd(30)}}  Fetch '${config.docker.pull.repo}:latest' from dockerhub
        {bold ${'image run'.padEnd(30)}}  Instantiate SQL Server instance from a local image
        {bold ${'container target'.padEnd(30)}}  Target CLI queries at an existing SQL Server Container
        {bold ${'batch'.padEnd(30)}}  TSQL entered and cached since last query execution on a Target SQL Server
        {bold ${'go'.padEnd(30)}}  Submit all TSQL in cache for execution by current Target SQL Server\n\n`
  },
  closeInstance: async containerId => {

    return Promise.resolve(api.sqlCatalog.Pools.get(containerId).close())
      .then( () => {
        api.sqlCatalog.Pools.delete(containerId)
      })

  },
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
    return [
      chalk`${api.bandAid()}   

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
  delimiter: chalk`anonym >`,
  developFile: async textFile => {

    api.log('log', `opening '${textFile}' in '${config.cli.ide}'`)
    if (!textFile.endsWith('sql')) {
      api.log('log', `Saved changes may not be recognized until ${api.name} is restarted`)
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

    // vim or Emacs for editing batch, Atom, code better (developeFile) for source files, can never remember how to use vim
    // SQLOps alpha does not accept text (or file) arg at the command-line, VS code accepts file but not text
    return new Promise( (resolve, reject) => {
      try {
        if (!config.cli.editor) {
          api.log('warn', `config.cli.editor undefined`)
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
  format: gi => {

    // implicit outer level, prolly not for recursive use
    let go=''
    switch (typeof gi) {
    case ('undefined'):
      go = 'undefined'.magenta
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
        gi.forEach( result => {
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
          gi.recordsets.forEach( rs => {
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
  genCA: async () => {

    // how to push a self-signed CA into the local OpenSUSE host's trusted key store 
    // https://blog.hqcodeshop.fi/archives/157-Installing-own-CA-root-certificate-into-openSUSE.html
    // and a 2018 example for why you should not want ANY self-signed creds in the trusted store
    // https://arstechnica.com/information-technology/2018/11/sennheiser-discloses-monumental-blunder-that-cripples-https-on-pcs-and-macs/
    // FWIW, we don't use the trusted store
    return new Promise( async (resolve, reject) => {
      try {
        try {
          fs.statSync(path.resolve(config.docker.bindings.private.mount.Source)).isDirectory()
        }
        catch(err) {
          if (err.code==='ENOENT') {
            fs.mkdirSync(path.resolve(config.docker.bindings.private.mount.Source))
          }
        }
        api.listFiles(config.docker.bindings.private.mount.Source, '.pem')
          .then( async (creds) => {
            // set common name to host name so maybe need to gen pkey and csr
            if (!creds.includes('CA-key.pem') && !creds.includes('CA-cert.pem')) {
              // await api.genPrivateKey('ca', 4096, 'aes256', config.ca.password) 

              createCertificate({
                "clientKeyPassword": config.cli.ca.password, 
                "selfSigned": true, 
                "days": 365
              }, async (err, result) => {
                if (err) reject(err)
                // {certificate, csr, clientKey, serviceKey} clientKey and Service Key same when self signed
                await api.writeCredential('CA-cert.pem', result.certificate)  
                await api.writeCredential('CA-key.pem', result.clientKey)  
                resolve()
              })
            } else if (!creds.includes('CA-key.pem') || !creds.includes('CA-cert.pem')) {
              reject(new Error(`CA corrupt`))
            } else {
              //no-op
              resolve()
            }
          })
          .catch( err => {
            reject(err)
          })
      }
      catch (err) {
        reject(err)
      }
    })

  },
  genSigningRequest: async name => {

    return new Promise( async (resolve, reject) => {
      try {
        // please donate to email shown at paypal.com if you use the anonym enough to want to change this, thank you  
        // be sure to run "certificate --hotelJuliet" after changes are saved
        // new creds will be immediately generated where enabled in config - service restarts may be needed 
        // but then, where it really matters, someone will have tested the hj to mastery and already knows just what to do
        createCSR({
          "clientKey": await api.fileToJSON(path.resolve(config.docker.bindings.private.mount.Source, `${name}-key.pem`)),
          "keyBitsize": 2048,
          "hash": "SHA256",
          "country": "US",
          "state": "CO",
          "locality": "Paypal",
          "organization": "Bill Wunder",
          "organizationalUnit": "anonym",
          "commonName": name==='ca'? hostname() :name, // avoid changing this one, the rest are no problem
          "emailAddress": "bwunder@yahoo.com"
        }, async (err, result) => {
          if (err) reject(err)
          await api.writeCredential(`${name}.csr`, result.csr)  
          resolve()  
        })
      }    
      catch (err) {
        reject(err)
      }
    })

  },  
  genCertificate: async (name, usage, secret) => {  

    return new Promise( async (resolve, reject) => {
      try {
        let ext = `${name}.cnf`
        let usages = ['serverAuth','clientAuth'] //,'codeSigning','emailProtection','timeStamping','ocspSigning'] 
        if (usages.includes(usage)) {
          let IPs = []
           // extended config
           for (let IP of await api.listHostIP4s()) {
            IPs.push(`IP:${IP}`)
          }
          await api.writeCredential(ext, `extendedKeyUsage = ${usage}\nsubjectAltName = DNS:${hostname()},${IPs}`)
          api.listFiles(config.docker.bindings.private.mount.Source, '.pem')
            .then( async (creds) => {
              if (!creds.includes(`CA-key.pem`) && !creds.includes(`CA-cert.pem`)) {
                throw(new Error('CA is corrupt'))
              }
              await api.genPrivateKey(name, secret)
              await api.genSigningRequest(name)                    
              createCertificate({
                "serviceKey": await api.fileToJSON(path.resolve(config.docker.bindings.private.mount.Source, `CA-key.pem`)),
                "serviceKeyPassword": config.cli.ca.password, 
                "serviceCertificate": await api.fileToJSON(path.resolve(config.docker.bindings.private.mount.Source, `CA-cert.pem`)),
                "days": 365,
                "csr": await api.fileToJSON(path.resolve(config.docker.bindings.private.mount.Source, `${name}.csr`)),
                "extFile": path.resolve(config.docker.bindings.private.mount.Source, ext)
              }, async (err, result) => {
                if (err) reject(err)
                await api.writeCredential(`${name}-cert.pem`, result.certificate)  
                //could rm the .csr and .cnf but can just o'write & Creds will be no safer: choosing to avoid the delete 
                resolve(api.log('confirm', `${name} certificate generated`))
              })
            })
            .catch( err => {
              reject(err)
            })
        }  
      }
      catch (err) {
        reject(err)
      }
    })

  },
  genPrivateKey: async (name, secret) => {

    return new Promise( async (resolve, reject) => {
      try {
        createPrivateKey(
          2048, 
          { "cipher": "SHA256", 
            "password": secret  
          }, async (err, result) => {
            if (err) reject(err)
            resolve(await api.writeCredential(`${name}-key.pem`, result.key))    
          })
      }
      catch (err) {
        reject(err)
      }
    })

  },
  getAddress: containerId => {

    

    let addressMap=new Map()
    if (containerId && api.sqCatalog.ContainerInfos.has(containerId)) {
      let info = api.sqCatalog.ContainerInfos.get(containerId)
      if (info.State==='running') {
        addressMap.set(containerId, {  
          bridge: `${info.NetworkSettings.Networks.bridge.IPAddress}:${info.Ports[0].PrivatePort}`,
          localhost: `${info.NetworkSettings.Networks.bridge.Gateway}:${info.Ports[0].PublicPort}`
        })
      }  
    } else { // container not found or not specifies
      if (api.sqlCatalog.ContainerInfos.size>0) {
        let id, info
        for ([id, info] of api.sqlCatalog.ContainerInfos) {
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
        let container = await api.docker.getContainer(containerId)
        let options = {
          Cmd: [config.cli.bash.path, '-c', `echo ${varName}`],
          AttachStdout: true,
          AttachStderr: true
        }
        container.exec(options, (err, exe) => { // Exec {modem:{Modem {...}}id: of ? - not the container}
          if (err) return
          exe.start( (err, stream) => { // stream is http socket
            if (err) return
            stream.on('data', data => {
              // trips eslint no-control-regex. Ignore here because this REMOVES control characters,
              // risk is that ignoring or disabling lint message could let in a coincidental mistake or exploit
              // add this note to ignore the lint message and leave this control code scrubber turned on
              resolve(data.toString().replace(/[\x00-\x1F\x7F-\x9F]/g, ""))
            })
            stream.on('error', err => {
              reject(err)
            })
          })
        })
      }
      catch (err){
        api.log('warn', `(getEnvVariables) error container: ${containerId}`)
        reject(err)
      }
    })

  },
  getInstanceInfo: containerId => {

    containerId = containerId || api.sqlCatalog.Instance
    if (api.sqlCatalog.ContainerInfos.has(containerId)) {
      return api.sqlCatalog.ContainerInfos.get(containerId)
    }

  },
  getImage: async imageId => {

    return new Promise( async (resolve, reject) => {
      try {
        if (!imageId) {
          if (api.sqlCatalog.Images.size===0) resolve(api.log('warn', `No images in catalog, try 'image --pull'`))
          else if (api.sqlCatalog.Images.size===1) resolve(api.sqlCatalog.Images.get(api.sqlCatalog.Images.keys().next()))
          else if (api.sqlCatalog.Instance) resolve(api.sqlCatalog.Images.get(api.getInstanceInfo().ImageID))
          else resolve(api.sqlCatalog.Images.get((await api.latestImage()).Id))
        } else resolve(api.sqlCatalog.Images.get(imageId))
      }
      catch(err) {
        reject(err)
      }
    })

  },
  getProcesses: async containerId => {

    return new Promise(async (resolve, reject) => {
      try{
        if (containerId && api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
          resolve((await api.docker.getContainer(containerId)).top("-x"))
        } else {
          api.log('warn', `(getProcesses) container not ready: ${containerId}`)
          resolve()
        }
      }
      catch (err) {
        api.log('error', `(getProcesses) error container: ${containerId}`)
        reject(err)
      }
    })

  },
  getTimestamp: () => { 
    // a valid string with no white space for file names
    return new Date().toISOString().replace(':','_')

  },
  hotelJuliet: async () => {

    return new Promise( async (resolve, reject) => {
      try {
        for (file of fs.readdirSync(config.docker.bindings.private.mount.Source)) {
          fs.unlinkSync(file)
        }
        await api.shelevate(`rm /etc/docker/daemon.json`)
        await api.genCA()
      }
      catch (err) {
        api.log('error', `(hotelJuliet) got high and went blind\n${err}`)
      }
    })

  },
  interactiveShell: (containerId, command) => {

    return new Promise(function(resolve, reject) {
      try {
        // fully concat then split to get all the white spaces  else spawnSync barfs 
        let spawnArgs = dockerCLIOptions.join(' ').split(' ').concat([`exec`, `--interactive`, `--tty`, `${containerId}`, config.cli.bash.path])
        if (command) spawnArgs.push(command)
        if (containerId) {
          api.log('log', chalk`Connecting as '{bold root}' to SQL Server container ${containerId}
            {bold bcp} & {bold sqlcmd} are now in the current $PATH. From this prompt, pass the
            env var as '-P $MSSQL_SA_PASSWORD' to either command when the user is sa (as '-U sa').
            Type {bold exit} when ready to close interactive session and resume the ${name} prompt.`)
          return resolve(spawnSync(`docker`, spawnArgs, {stdio: [0, 1, 2]}))
        }
      }
      catch(err) {
        reject(err)
      }
    })

  },
  intern: async instanceId => {

    try {
      if (await api.attachDocker()) {
        process.stdout.write(`\u2042  `)
        instanceId = (instanceId || await store.pools.getLastInstanceId()).substring(0,12)
        api.sqlCatalog.Images = new Map()
        api.sqlCatalog.ContainerInfos = new Map()
        api.sqlCatalog.Instance
        api.sqlCatalog.Pools = api.sqlCatalog.Pools || new Map()
        if (await api.internImages()) {
          if (await api.internContainers()) {
            if (!instanceId) {
              if (api.sqlCatalog.ContainerInfos.size===1) {
                instanceId=api.sqlCatalog.ContainerInfos.keys().next()
              } else if (api.listInstances('running').length===1) {
                  instanceId = api.listInstances('running')[0]                  
              }
            }
          }
          if (api.sqlCatalog.ContainerInfos.has(instanceId)) {
            await api.internInstance(instanceId)
            if (instanceId===api.sqlCatalog.Instance) { 
              if (api.sqlCatalog.ContainerInfos.get(instanceId).State==='running') {
                process.stdout.write(chalk` target: {bold.cyan ${instanceId}}\n`)
                await api.openInstance(instanceId)
              } else {
                process.stdout.write(chalk` target: {red ${instanceId.substring(0,12)}}\n`)
                api.log('log', chalk`\u2042 {yellow Target SQL Container '${instanceId}' is not 'running'}, try {bold container start}`)
              }
            } else {
              api.log('log', chalk`\u2042 {yellow Targeted SQL Server not found}, ${instanceId}`)
            }
          } else {
            api.log('log', chalk`\u2042 {yellow No Local SQL Containers found}`)
          }
        } else {
          api.log('log', chalk`\u2042 {rgb(127,255,0) check engine}`)
        }
      }
    }
    catch(err) {
      api.log('error', err)
    }

  },
  internContainers: async () => {

    // insert order by image id
    try {
      for (let [imageId] of api.sqlCatalog.Images ) {
        let containers = await api.docker.listContainers({
          "all": true,
          "size": true,
          "filters": { "ancestor": [`${imageId}`] }
        })
        for (let info of containers)  {
          if (info.State=='running') {
            process.stdout.write(chalk.green`\u25CF`)
          } else {
            process.stdout.write(chalk.red`\u25C9`)
          }
          api.sqlCatalog.ContainerInfos.set(info.Id.substring(0,12), info)
        }
      }
      return true
    }
    catch(err) {
      api.log('warn', `\u2042 (InternContainers) failed, image ${imageId}\n${err.stack}`)
      return false
    }

  },
  internImages: async () => {

    // will be first place to fail at startup if user not in docker group (do it!)
    // sudo usermod -aG docker $USER 
    try {
      let images= await api.docker.listImages()
      for (let image of images) {
        if (image.RepoDigests[0].startsWith(`${config.docker.pull.repo}@`)) {
          let shortid = image.Id.includes(':')? image.Id.substring(image.Id.indexOf(':')+1, image.Id.indexOf(':')+1+12): image.Id.substring(0, 12)
          process.stdout.write(chalk.blue`\u25B2`)
          api.sqlCatalog.Images.set(shortid, image)
        }
      }
      return true
    }
    catch(err) {
      if (err.code==='EACCES') {
        api.log('log', chalk`\u2042 {yellow 'EACESS': user '${process.user}' unauthorized}`)
      } else {
        api.log('log', `\u2042 (InternImages) failed\n${err.stack}`)
      }
      return false
    }

  },
  internInstance: (instanceId=api.sqlCatalog.Instance) => {

    try {
      if (api.sqlCatalog.ContainerInfos.has(instanceId)) {
        api.sqlCatalog.Instance = instanceId.substring(0,12)
        return true
      }
    }
    catch(err) {
      api.log('warn', `\u2042 (internInstance) failed, container ${instanceId}\n${err.stack}`)
      return false
    }

  },
  internPool: async (instanceId=api.sqlCatalog.Instance, pool) => {

    try {
      await store.pools.update(instanceId, pool.config)
      api.sqlCatalog.Pools.set(instanceId, await store.pools.get(instanceId))
      return true
    }
    catch(err) {
      api.log('warn', `\u2042 (internPool) failed, container ${instanceId}\n${err.stack}`)
      return false
    }

  },
  isHost: async () => {

    return new Promise( async (resolve, reject) => {
      try {
        // needed if-else to eliminate "(isHost) TypeError: Cannot read property 'ping' of undefined"
        if (typeof api.docker==='undefined') {
          resolve(false) 
        } else {
          api.docker.ping()
          resolve(true)
        } 
      }
      catch(err) {
        api.log('error', `(isHost) ${err}`)
        reject(err)
      }
    })

  },
  isSigned: async certFile => {

    return new Promise( async (resolve, reject) => {
      let cacert = await api.fileToJSON(path.resolve(config.docker.bindings.private.mount.Source, config.cli.ca.cert))  
      try {
        let cert = await api.fileToJSON(certFile)
        verifySigningChain(cert, cacert, async (err, valid) => {
          if (err) reject(err)
          resolve(valid)
        })
      }
      catch(err) {
        if (err.code==='ENOENT') {
          api.log('warn', `(isSigned) no certificate for TLS: ${certFile}`)
        } else {
          api.log('warn', `(isSigned) ${err}`)
        }
        resolve(false)
      }    
    })    
  
  },
  JSONtoFile: async (obj, toFile) => {

    fs.writeFileSync(path.resolve(toFile), obj, 'utf8')

  },
  latestInstances: async (limit=3) => {

    return Promise.resolve(api.docker.listContainers({"last": limit}))
      .then( (containers) => {
        let latest=[]
        // have done nothing to assure these last! assumes fifo based on nothing
        for (let containerInfo of containers) {
          if (containerInfo.Labels["com.microsoft.product"]==="Microsoft SQL Server") {
            latest.push({Id: containerInfo.Id, $$DATE: containerInfo.Created})
          }
        }
        return latest
      }).catch( err => {
        api.log('error', `(latestInstances) error\n${err.stack}`)
      })

  },
  latestImage: () => {

    for (let image of api.listImages()) {
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
  listDatabases: async () => {

    let databases = []
    let results = await sqldb.query('select name from sysdatabases', api.sqlCatalog.Instance)
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
  listHostIP4s: async () => {

    return new Promise( (resolve, reject) => {
      try {
        let interfaces = networkInterfaces()||[]
        let publicIPs = [] 
        for (let face of Object.keys(interfaces)) {
          for (let net of interfaces[face]) {
            if (/^IPv4/i.test(net.family)) {
              if (net.address!=="127.0.0.1" && !face.includes('docker')) {
                publicIPs.push(net.address)
              }
            }
          }  
        }
        resolve(publicIPs)  
      }
      catch(err) {
        reject(err)
      }
    })

  },
  listInstances: state => {

    let list=[]
    let id=''
    let info={}
    if (api.sqlCatalog.ContainerInfos.size>0) {
      for ([id, info] of api.sqlCatalog.ContainerInfos) {
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
    if (api.sqlCatalog.ContainerInfos && api.sqlCatalog.ContainerInfos.size>0) {
      for ([id, info] of api.sqlCatalog.ContainerInfos) {
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
    if (api.sqlCatalog.Images.size>0) {
      for (let [id, image] of api.sqlCatalog.Images) {
        if (!imageId || imageId===id) {
          list.push(image)
        }
      }
    }
    return list

  },
  listPools: containerId => {

    // wrong - only pool is target - no matter how many copies
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
      // will have chalk marks (color codes) 
      if (['confirm', 'debug', 'error', 'info', 'log', 'test', 'warn'].includes(mode)) {
        switch (mode) {
        case ('confirm'):
          process.stdout.write(chalk`{bold.green \u2611}  ${api.format(data)}`)
          break
        case ('debug'):
          process.stdout.write(`\u2370  ${api.format(data)}`)
          break
        case ('error'):
          process.stderr.write(chalk`{bold.red \u274E}  ${api.format(data)}`)
          break
        case ('info'):
          process.stdout.write(chalk`{bold.blue \u2B50}  ${api.format(data)}`)
          break
        case ('log'):
          process.stdout.write(api.format(data))
          break
        case ('test'):
          process.stdout.write(chalk`${"\u{1F50E}"}  ${api.format(data)}`)
          break
        case ('warn'):
          process.stdout.write(chalk`{bold.yellow \u2621}  ${api.format(data)}`)
          break
        }
      }
    }
    catch (e) { 
      process.stdout.write(chalk`{bold.red (log) failed}  mode: ${mode} type of passed data ${typeof data}\n${e.stack}\n`)
    }

  },
  mssqlConf: (containerId, confArgs) => {

    // mssql-conf not compiled in RTM image and no make? config.mssql.conf using the .py file it links to...
    new Promise( async (resolve, reject) => {
      if (api.sqlCatalog.ContainerInfos.has(containerId)) {
        let options = {
          Cmd: [config.cli.bash.path, '-c', `${config.mssql.conf} ${confArgs}`],
          AttachStdout: true,
          AttachStderr: true
        }
        let container= await api.docker.getContainer(containerId)
        container.exec(options, (err, exe) => {
          if (err) reject(err)
          exe.start( (err, stream) => {
            if (err) reject(err)
            container.modem.demuxStream(stream, process.stdout, process.stderr)
            // return resolve(exec.inspect(() => {})) // empty callback seems to supress output of meta into my stdout
            return resolve(exe.inspect( (err, data) => {
              if (err) reject(err)
              return data
            }))
          })
        })
      }
    })

  },
  mssqlFiles: (containerId=api.sqlCatalog.Instance, folder, filter) => {

    return new Promise( async (resolve, reject) => {
      try{
        api.log('log', chalk.gray(`\tcontainerId: ${containerId} \n\tfolder: ${folder} \n\tfilter: ${filter}`) )
        // if (!containerId) containerId = api.sqlCatalog.Instance
        if (api.sqlCatalog.ContainerInfos.get(containerId).State=='running') {
          let options = {
            Cmd: [config.cli.bash.path, '-c', `ls -lb ${folder} | grep ${filter}`],
            AttachStdout: true,
            AttachStderr: true
          }
          let container = await api.docker.getContainer(containerId)
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
  name: name,
  openInstance: async (containerId, database='master', user='sa', password) => {

    return new Promise( async (resolve, reject) => {
      try {
        let info = await api.getInstanceInfo(containerId)
        config.mssql.pool.database = database                    
        config.mssql.pool.port = info.Ports[0].PublicPort        
        config.mssql.pool.user = user                            // user, pwd, server hits tds as peers of options
        config.mssql.pool.password = user!=='sa'? password: await api.getEnvVariable(containerId, `$MSSQL_SA_PASSWORD`)
        return api.getProcesses(containerId)
          .then( async (top) => {
            if (top) {
              let sqlBin = await api.getEnvVariable(containerId, `$MSSQL_BIN_DIR`)
              if (top.Processes.length===0 || !top.Processes.join().includes(path.join( sqlBin, `sqlservr`))) {
                reject(new Error(`SQL Server process not detected: Container '${containerId}'`))
              }
              api.internPool(containerId, await require('../lib/sqldb').openPool(config.mssql.pool))
            }    
            resolve()
          })
          .catch(err => {
            api.log('error', `(openInstance) container problem`)
            api.log('error', err)
            // resolve()
          })
      }
      catch (err) {
        reject(err)
      }
    })

  },
  pullImage: async () => {

    return new Promise( (resolve, reject) => {
      try {
        api.docker.pull(`${config.docker.pull.repo}:${config.docker.pull.tag}`, function(err, stream) {
          if (err) {
            store.pulls.put(err)
            reject(err)
          }
          api.docker.modem.followProgress(stream, onFinished, onProgress)
          function onProgress(evt) {
            process.stdout.write('.')
          }
          function onFinished(err, output) {
            process.stdout.write(`!\n`) // the bang signals finished event
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
  removeInstance: async containerId => {

    if (api.sqlCatalog.ContainerInfos.has(containerId)) {
      await api.docker.getContainer(containerId).remove()
    }

  },
  renameInstance: async (containerId, name) => {

    if (api.sqlCatalog.ContainerInfos.has(containerId)) {
      let oldName = api.sqlCatalog.ContainerInfos.get(containerId).Names[0] 
      await api.docker.getContainer(containerId).rename({oldName, name})
    }

  },
  restartInstance: async (containerId=api.sqlCatalog.Instance) => {

    if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
      process.stdout.write(`restarting ${containerId} `)
      return await api.docker.getContainer(containerId).restart()
        .then( async () => {
          await api.tailLog(containerId, 0, false)
        })
        .catch( async err => {
          api.log('error', `(restartInstance) malfunction`)
          api.log('error', err)
        })
    } else {
      api.log('warn', chalk`(restartInstance) ${containerId} is not running, did you mean {bold container --start}`)
    }
  },
  restoreScript: async scriptName => {

    fs.writeFileSync(scriptName, await store.scripts.get(scriptName))

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
                fs.mkdirSync(path.resolve(config.docker.bindings.backups.mount.Source))
              }
              catch (err) {
                if (err.code!=='EEXIST') reject(err)
              }
              try {
                config.docker.bindings.private.mount.Source=path.resolve(config.docker.bindings.private.mount.Source)
                fs.mkdirSync(path.resolve(config.docker.bindings.private.mount.Source))
              }
              catch (err) {
                if (err.code!=='EEXIST') reject(err)
              }
              try {
                config.docker.bindings.staging.mount.Source=path.resolve(config.docker.bindings.staging.mount.Source)
                fs.mkdirSync(path.resolve(config.docker.bindings.staging.mount.Source))
              }
              catch (err) {
                if (err.code!=='EEXIST') reject(err)
              }
              let mounts= [
                config.docker.bindings.backups.mount,
                config.docker.bindings.private.mount,
                config.docker.bindings.staging.mount
              ]
              let enviro = []
              for (let envirovar of Object.keys(config.mssql.env)) {
                if (config.mssql.env[envirovar]) {
                  enviro.push(`${envirovar}=${config.mssql.env[envirovar]}`)
                }
              }
              return api.docker.createContainer({
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
            .then( async container => {
              // ??? If a video is streaming in, this will at least try to kill it ???
              await container.start()
            // })
            // .then( async () => {
              resolve(await api.intern())
              // resolve(api.log('confirm', await store.pools.getLastInstanceId()))
            })
        }
      }
      catch (err) {
        api.log('error', `(runImage) ${err.message}`)
        reject(err)
      }
    })

  },
  setEngine: (action=`status`) => {

    return new Promise( async (resolve, reject) => {
      try {
        return api.shelevate(`getent group docker`)
          .then( async group => {
            if (!group) throw(new Error('(setEngine) docker group not found'))
            if (!group.includes(process.env.USER)) {
              api.log('info', await api.shelevate(`usermod -aG docker ${process.env.USER}`))
            }
            if (action==='status') {
              resolve( await api.shelevate(`systemctl status dockerd`))
            } else {
              await api.shelevate(`service docker ${action}`)
              if (action!=='stop') await api.intern()
              resolve(true) 
            }  
          })  
          .catch( err => {
            api.log('error', `(setEngine) failed\n${err.message}\n`)
            reject(err)
          })
      }
      catch(err) {
        reject(err)
      }
    })

  },
  shelevate: async bashCommand => { 

    return new Promise( async (resolve, reject) => {
      try {
        if (config.cli.log.elevations) {
          api.log('log', chalk`{bold.yellow ${"\u{1F934}"}}  {magenta ${bashCommand}}`)
        }
        exec(`sudo ${bashCommand}`, (err, stdout, messages) => {
          if (err) {
            if (err.code) {
              resolve(api.log('error', `(shelevate) callback error ${err}`))
              exec(`sudo systemctl  status docker.service`, (err, stdout, messages) => {
                if (err) api.log('error', 'err')
                api.log('log', `stdout ${stdout}`)          
                api.log('log', `messages ${messages}`)          
              })
            } else {
            // hot potato
              reject(new Error(`(shelevate) subprocess returned an exception:\n${err}`))
            }
          }
          // from subprocess io stream
          if (messages) resolve(api.log('confirm', `(shelevate) ${messages}`))
          resolve(stdout.trim())
        })
      }
      catch(er) {
        exec(`sudo systemctl  status docker.service`, (err, stdout, messages) => {
          if (err) api.log('error', 'err')
          api.log('log', `stdout ${stdout}`)          
          api.log('log', `messages ${messages}`)          
          reject(er)
        })
      }  
    })

  },
  shell: async (containerId, command, tsql) => {
    
    return new Promise( async (resolve, reject) => {
      try {
        let container = await api.docker.getContainer(containerId)           
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
  sqlCatalog: {},
  sqlpad: {},
  startInstance: async (containerId=api.sqlCatalog.Instance) => {

    if (api.sqlCatalog.ContainerInfos.get(containerId).State!=='running') {
      process.stdout.write(`starting ${containerId} .`)
      return api.docker.getContainer(containerId).start()
        .then( async () => {
          await api.tailLog(containerId,0,false)
        })
        .catch( err => {
          api.log('warn', `(startInstance) malfunction`)
          api.log('error', err)
        })
    } else {
      api.log('warn', chalk`(startInstance) ${containerId} is already running, try {bold container --restart} ?`)
    }

  },
  stopInstance: async (containerId=api.sqlCatalog.Instance) => {

    if (containerId && api.sqlCatalog.ContainerInfos.has(containerId)) {
      if (api.sqlCatalog.ContainerInfos.get(containerId).State==='running') {
        await api.docker.getContainer(containerId).stop()
      }
    }

  },
  startSQLPad: async () => {

    return new Promise( async(resolve, reject) => {
      try {
        let args = []
        if (!sqlpad.sqlpad) resolve()
        let credsPath = path.resolve(config.docker.bindings.private.mount.Source)
        await api.genCertificate('sqlpad', 'serverAuth', sqlpad["cert-passphrase"])
        sqlpad["key-path"] = `${path.join(credsPath, sqlpad.key)}`
        sqlpad["cert-path"] = `${path.join(credsPath, sqlpad.cert)}`
        Object.keys(sqlpad).forEach( key => {
          if (sqlpad[key]) {
            args.push( key.length==1? `-${key}`: `--${key}` )
            args.push( sqlpad[key])
          }
        })
        sqlpad.sqlpad = spawn('sqlpad', args)
        sqlpad.sqlpad.on('error',  err => {
          api.log('error', chalk`{cyan.bold (sqlpad)} {red error}`)
          api.log('error', err)
        })
        sqlpad.sqlpad.stdout.on('data', data => {
          if (/Welcome/.test(data)) {            
            config.sqlpad.protocol= data.toString().includes('https:')?'https':'http'
            resolve(api.log('log', chalk.cyan.bold(data) +
               chalk`\n{bold (sqlpad)} browser wih V8 is required (e.g., Chrome or Chromium)`))
            } else {
            if (sqlpad.debug) {
              api.log('debug', chalk`{cyan.bold (sqlpad)} {gray ${data}}`)
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
      catch(err) {
        api.log('error', `(startSQLPad) error`)
        reject(err)
      }
    })

  },
  tailLog: async (containerId, tail=0, feedback=true) => {

    return new Promise( async (resolve, reject) => {
      let container = await api.docker.getContainer(containerId) // passing id to promise returns 'logger is not defined'
      if (container) {
        process.stdout.write(`tail`)
        let logStream = new PassThrough()
        container.logs({
          tail: tail,
          follow: true,
          stdout: true,
          stderr: true
        }, (err, stream) => {
          if (err) {
            api.log('error', `(tailLog) error`)
            api.log('error', err)
            reject(err)
          }
          container.modem.demuxStream(stream, logStream, logStream)
          stream.on('data', data => {
            switch (true) {
            case (data.includes('SQL Server is now ready')):
              process.stdout.write(chalk`{bold.cyan listening\n}`)
            stream.emit('end')
              break
            case (/error\s/i.test(data)):
              process.stderr.write(chalk.red`\n${data}\n`)
              break
            case (feedback):
              api.log('log', data)
              break
            default:
              process.stdout.write('.')
              break
            }
          })
          stream.on('end', () => {
            resolve(process.stdout.write, `\n`)
          })
          setTimeout( () => {
            if (stream) {
              stream.emit('end')
            }
          }, 20000) 
        })
      }
    })

  },
  writeCredential: async (credential, cipher) => {

    return new Promise( (resolve, reject) => {
      try {
        fs.writeFile(path.resolve(config.docker.bindings.private.mount.Source, credential), cipher, err => {
          if (err) reject(err)
          resolve()
        })
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
