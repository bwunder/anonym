////NPM
const { createCertificate, createCSR, createPrivateKey, verifySigningChain } = require('pem')
// pem.config({
//   pathOpenSSL: '/usr/local/bin/openssl' // ?? config.CA.pathOpenSSL ??
// })
////core
const fs = require('fs')
const { hostname, networkInterfaces } = require('os')
const path = require('path')
////local
const { errors, words } = require('../lib/store')
const { format, log } = require('../lib/log')

const config = require('../config/config.json')
const package = require('../package.json')

const credsPath = config.docker.bindings.private.hostPath 
const caCert = () => path.resolve(credsPath, `${config.ca.name}-cert.pem`)
const caKey = () => path.resolve(credsPath, `${config.ca.name}-key.pem`)
const serverCert = () => path.resolve(credsPath, `${config.docker.daemon.name}-cert.pem`)
const serverKey = () => path.resolve(credsPath, `${config.docker.daemon.name}-key.pem`)
const clientCert = () => path.resolve(credsPath, `${config.docker.daemon.name}CLI-cert.pem`)
const clientKey = () => path.resolve(credsPath, `${config.docker.daemon.name}CLI-key.pem`)

const creds = () => { 
  return fs.readdirSync(path.resolve(credsPath))
}

const readCredential = async (filePath) => {
  return new Promise( async (resolve, reject) => {
    try {
      fs.readFile(filePath, async (err, data) => {
        if (err) {
          await errors.put(err)
          reject(err)
        }  
        resolve(data)
      })
    }
    catch(err) {
      await errors.put(err)
      reject(log('error', `(readCredential) error\n${format(err)}`))
    }
  })
}

const writeCredential = async (filePath, cipherText) => {
  return new Promise( async (resolve, reject) => {
    try {
      fs.writeFile(filePath, cipherText, async err => {
        if (err) {
          await errors.put(err)
          reject(err)
        }  
        resolve()
      })
    }
    catch(err) {
      await errors.put(err)
      reject(log('error', `(writeCredential) error\n${format(err)}`))
    }
  })
}

const genCA = async () => {
  return new Promise( async (resolve, reject) => {
    try {
      let files = creds()
      if (!files.includes(path.basename(caKey())) || !files.includes(caCert())) {
        createCertificate({
          "clientKeyPassword": config.ca.password, 
          "selfSigned": true, 
          "days": 7
        }, async (err, result) => {
          if (err) reject(err)
          await writeCredential(caCert(), result.certificate)  
          await writeCredential(caKey(), result.clientKey)  
          resolve(`(genCA) Generated self-signed Certificate Authority (CA) credentials`)
        })
      } else {
        resolve('(genCA) nothing to do') 
      }
    }
    catch (err) {
      reject(log('error', `(genCA) error\n${format(err)}`))
    }
  })
}

const genCertificate = async (name, usage, secret) => {  
  return new Promise( async (resolve, reject) => {
    try {
      if (!name) throw(new Error('(genCertificate) name arg is required but not supplied'))
      let ext = `${name}.cnf`
      let usages = ['serverAuth','clientAuth'] //,'codeSigning','emailProtection','timeStamping','ocspSigning'] 
      if (usages.includes(usage)) {
        let IPs = []
        // extended config
        IPs.push(`IP:127.0.0.1`)
log('info', `(genCertificate) docker net\n${format(networkInterfaces()[config.docker.networkInterface])}`)        
        // for (let IP of await listHostIP4s()) {
        //   IPs.push(`IP:${IP}`)
        // }
        await writeCredential(path.resolve(credsPath, ext), 
          `extendedKeyUsage = ${usage}\nsubjectAltName = DNS:${hostname()},${IPs}`)
        let files = creds()
        if (!files.includes(`${config.ca.name}-key.pem`) || !files.includes(`${config.ca.name}-cert.pem`)) {
          log('warn', '(genCertificate) CA is missing or corrupt, begin hotelJuliet (complete recredential)')
          resolve(hotelJuliet())
        }
        await genPrivateKey(name, secret)
        await genSigningRequest(name)                    
        createCertificate({
          "serviceKey": await readCredential(caKey()),
          "serviceKeyPassword": config.ca.password, 
          "serviceCertificate": await readCredential(caCert()),
          "days": config.ca.lifetime,
          "csr": await writeCredential(path.resolve(credsPath, `${name}.csr`)),
          "extFile": path.resolve('private', ext)
        }, async (err, result) => {
          if (err) reject(err)
          resolve(await writeCredential(path.resolve(credsPath, `${name}-cert.pem`), result.certificate))  
        })
      }  
    }
    catch (err) {
      reject(log('error', `(genCertificate) error\n${format(err)}`))
    }
  })
}

const genPrivateKey = async (name, secret) => {
  return new Promise( async (resolve, reject) => {
    try {
      createPrivateKey(
        2048, 
        { "cipher": config.ca.hash, 
          "password": secret  
        }, async (err, result) => {
          if (err) reject(err)
          resolve(await writeCredential(path.resolve(credsPath, `${name}-key.pem`), result.key))    
        })
    }
    catch (err) {
      reject(log('error', `(genPrivateKey) error\n${format(err)}`))
    }
  })
}

const genSigningRequest = async name => {
  return new Promise( async (resolve, reject) => {
    try {
      createCSR({
        "clientKey": await readCredential(path.resolve(credsPath, `${name}-key.pem`)),
        "keyBitsize": config.ca.csr.keyBitsize,
        "hash": config.ca.hash,
        "country": config.ca.csr.country,
        "state": config.ca.csr.state,
        "locality": config.ca.csr.locality,
        "organization": package.author.name,
        "organizationalUnit": package.name,
        "commonName": name==='ca'? `${hostname()}.anonym.dev` :name, 
        "emailAddress": package.author.email
      }, async (err, result) => {
        if (err) reject(err)
        resolve(await writeCredential(path.resolve(credsPath, `${name}.csr`), result.csr))  
      })
    }    
    catch (err) {
      reject(log('error', `(genSigningRequest) error\n${format(err)}`))
    }
  })
}

const hotelJuliet = async () => {
  return new Promise( async (resolve, reject) => {
    try { //ReferenceError: file is not defined
      let files = creds() 
      if (fs.existsSync(caCert())) fs.unlinkSync(caCert())
      files.splice(files.indexOf(path.basename(caCert())), 1)      
      if (fs.existsSync(caKey())) fs.unlinkSync(caKey())
      files.splice(files.indexOf(path.basename(caKey())), 1)      
      await genCA()
      for (cred of files) {
        if (cred.endsWith('-cert.pem')) {
          let name = cred.substring(0, cred.indexOf('-cert.pem'))
//TODO ??? prompt for new secret here ??? then encrypt secret into words.db
// this also needs to rebuid based on config.json not existing
          if (['.cnf', '.csr', '.json', '.pem'].includes(path.extname(cred))) fs.unlinkSync(path.resolve(credsPath, cred))
          let secret = await words.getLast(name) || config[name].secret          
log('confirm', `(hotelJuliet) save this secret ${secret}`)      
          await genCertificate(name, name.includes('CLI')? 'clientAuth': 'serverAuth', secret)        
        }
      }
      resolve()
    }
    catch (err) {
      reject(new Error(`(hotelJuliet) got high and went blind\n${format(err)}`))
    }
  })
}

const isSigned = async certFile => {
  return new Promise( async (resolve, reject) => {
    let cacert = await readCredential(caCert())
    try {
      let cert = await readCredential(certFile)
      verifySigningChain(cert, cacert, async (err, valid) => {
        if (err) {
          if (err)
log('confirm', `(isSigned) err.code ${err}`)           
// from info openssl-verify
// -check_ss_sig
// Verify the signature on the self-signed root CA. This is disabled by default because it doesn't add any security.
// CRL is
// -crl_check_all
// Checks the validity of all certificates in the chain by attempting to look up valid CRLs.
          reject(err)
        }  
        resolve(true)
      })
    }
    catch(err) {
      if (err.code==='ENOENT') {
        log('warn', `(isSigned) no certificate for TLS: ${certFile}`)
      } else {
        log('warn', `(isSigned) ${err}`)
      }
      reject(log('error', `(isSigned) error\n${format(err)}`))
    }    
  })    
}

// client side connector object used by dockerode API
const setDockerAPI = async (IP) => {
  return new Promise( async (resolve, reject) => {
    try {
      let apiOptions 
      //= {
      //   socketPath: config.docker.daemon.socketPath
      // }
      if (config.docker.daemon.tls && IP) {        // server needs serverAuth credentials 
        apiOptions.protocol = 'https'
        apiOptions.port = config.docker.daemon.tlsPort  
        if (config.docker.api.tlsverify) {   // dockerode and bash prompt need clientAuth credentials 
          if (!fs.existsSync(clientCert())) await genCertificate('dockerCLI', 'clientAuth', config.docker.api.password)
          if (!await isSigned(clientCert())) { 
            reject(new Error(`(attachDocker) CLI certificate not signed by our CA\n${clientCert()}`))
          }  
          apiOptions.ca = fs.readFileSync(caCert())
          apiOptions.cert = fs.readFileSync(clientCert())
          apiOptions.key = fs.readFileSync(clientKey())
        }  
      } 
      // else {
      //   apiOptions.port = config.docker.daemon.dftPort  
      //   apiOptions.protocol = 'http'
      // } 
// log('confirm', `(setDockerAPI) apiOptions:\n${format(apiOptions)}`)
      resolve(apiOptions)
    }
    catch(err) {
      reject(log('error', `(setDockerAPI) error\n${format(err)}`))
    }
  })
}

// client side connector for bash shell (api.interactiveShell())
const setDockerShell = async (IP) => {
  return new Promise( async (resolve, reject) => {
    try {
      let cliOptions //= `-H unix://${config.docker.daemon.socketPath}`
      if (config.docker.daemon.tls && IP) {
        if (config.docker.api.tlsverify) {
          if (!fs.existsSync(clientCert())) await genCertificate('dockerCLI', 'clientAuth', config.docker.api.password)
          if (!await isSigned(clientCert())) {
            reject(new Error(`(attachDocker) CLI certificate not signed by our CA\n${clientCert()}`))
          }
          cliOptions.concat(` --tls`)
          cliOptions.concat(` --tlsverify`)
          cliOptions.concat(` --tlscacert ${caCert()}`) 
          cliOptions.concat(` --tlscert ${clientCert()}`)
          cliOptions.concat(` --tlskey ${clientKey()}`)
        }  
        if (IP) cliOptions.concat(` -H tcp://${IP}:${config.docker.daemon.tlsPort}`)
      }  
// log('confirm', `(setDockerShell) cliOptions:\n${format(cliOptions)}`)
      resolve(cliOptions)
    }
    catch(err) {
      reject(log('error', `(setDockerShell) error\n${format(err)}`))
    }
  })
}

const setDockerDaemon = async (IP) => {
  return new Promise( async (resolve, reject) => {
    try {
      let daemonOptions
      if (config.docker.daemon.tls && IP) {
        //tcp://[host]:[port][path] or unix://path
        daemonOptions.hosts = [ `tcp://${IP}:${config.docker.daemon.tls}` ]
        if (!fs.existsSync(serverCert()) || !fs.existsSync(serverKey())) {
          await api.secret(`Docker daemon Certificate Password`, config.docker.daemon.password)
          await genCertificate(config.docker.daemon.name, 'serverAuth', config.docker.daemon.password)
        }  
        if (!await isSigned(serverCert())) {
          reject(new Error(`(attachDocker) daemon certificate not signed by our CA\n${serverCert()}`))
        }  
        daemonOptions.debug = true
        daemonOptions.tls = config.docker.daemon.tls
        daemonOptions.tlsverify=config.docker.api.tlsverify
        daemonOptions.tlscacert = caCert()
        daemonOptions.tlscert = serverCert()
        daemonOptions.tlskey = serverKey()
      } 
// log('confirm', `(setDockerDaemon) daemonOptions:\n${format(daemonOptions)}`)
      resolve(daemonOptions)
    }
    catch(err) {
      reject(log('error', `(setDockerDaemon) error\n${format(err)}`))
    }
  })
}

module.exports = tls = {
  genCA,
  genCertificate,
  hotelJuliet,
  setDockerAPI,
  setDockerShell,
  setDockerDaemon
}

/*
https://kerneltalks.com/howto/how-to-setup-domain-name-in-linux-server/

sudoedit /etc/hosts add docker assigned host IP and domain HOST.anonym.com
cat /etc/hosts
127.0.0.1	localhost
127.0.1.1	HOST
172.17.0.1      HOST.anonym.dev HOST           <--added this line

# The following lines are desirable for IPv6 capable hosts
::1     ip6-localhost ip6-loopback
fe00::0 ip6-localnet
ff00::0 ip6-mcastprefix
ff02::1 ip6-allnodes
ff02::2 ip6-allrouters

then 
 sudoedit /etc/hostname
 change entry from HOST to Host.anonym.dev

then, eventually,  after many "domain not found" failures in tail

bill@HOST:~$ hostname 
HOST.anonym.dev
bill@HOST:~$ hostname -d
anonym.dev
bill@HOST:~$ domainname 
(none)
bill@HOST:~$ dnsdomainname 
anonym.dev
bill@HOST:~$ domainname 
(none)

bill@HOST:~$ sudo domainname -y anonym.dev

bill@HOST:~$ domainname 
anonym.dev

and it still fails every time....

*/
