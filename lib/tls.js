////NPM
const { createCertificate, createCSR, createPrivateKey, verifySigningChain } = require('pem')
////core
const fs = require('fs')
const { hostname, networkInterfaces } = require('os')
const path = require('path')
////local
const { errors } = require('../lib/store')
const config = require('../config/config.json')
const { log } = require('../lib/log')

const writeCredential = async (credential, cipher) => {

  return new Promise( async (resolve, reject) => {
    try {
      fs.writeFile(path.resolve(config.docker.bindings.private.mount.Source, credential), cipher, async err => {
        if (err) {
          await errors.put(err)
          reject(err)
        }  
        resolve()
      })
    }
    catch(err) {
      await errors.put(err)
      reject(err)
    }
  })

}

module.exports = tls = {

  genCA: async () => {

    // how to push a self-signed CA into the local OpenSUSE host's trusted key store 
    // https://blog.hqcodeshop.fi/archives/157-Installing-own-CA-root-certificate-into-openSUSE.html
    // and a 2018 example for why you should not want ANY self-signed creds in your trusted store EVER
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
              createCertificate({
                "clientKeyPassword": config.cli.ca.password, 
                "selfSigned": true, 
                "days": 365
              }, async (err, result) => {
                if (err) reject(err)
                await writeCredential('CA-cert.pem', result.certificate)  
                await writeCredential('CA-key.pem', result.clientKey)  
                resolve()
              })
            } else if (!creds.includes('CA-key.pem') || !creds.includes('CA-cert.pem')) {
              reject(new Error(`CA corrupt`))
            } else {
              resolve() // no-op
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
        // please donate at paypal.com to email shown , thank you  
        // and be sure to hj - e.g., run "certificate --hotelJuliet" after changes are saved
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
          await writeCredential(`${name}.csr`, result.csr)  
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
          for (let IP of await tls.listHostIP4s()) {
            IPs.push(`IP:${IP}`)
          }
          await writeCredential(ext, `extendedKeyUsage = ${usage}\nsubjectAltName = DNS:${hostname()},${IPs}`)
          api.listFiles(config.docker.bindings.private.mount.Source, '.pem')
            .then( async (creds) => {
              if (!creds.includes(`CA-key.pem`) && !creds.includes(`CA-cert.pem`)) {
                throw(new Error('CA is corrupt'))
              }
              await tls.genPrivateKey(name, secret)
              await tls.genSigningRequest(name)                    
              createCertificate({
                "serviceKey": await api.fileToJSON(path.resolve(config.docker.bindings.private.mount.Source, `CA-key.pem`)),
                "serviceKeyPassword": config.cli.ca.password, 
                "serviceCertificate": await api.fileToJSON(path.resolve(config.docker.bindings.private.mount.Source, `CA-cert.pem`)),
                "days": 365,
                "csr": await api.fileToJSON(path.resolve(config.docker.bindings.private.mount.Source, `${name}.csr`)),
                "extFile": path.resolve(config.docker.bindings.private.mount.Source, ext)
              }, async (err, result) => {
                if (err) reject(err)
                await writeCredential(`${name}-cert.pem`, result.certificate)  
                //could rm the .csr and .cnf but can just o'write & Creds will be no safer: choosing to avoid the delete 
                resolve(log('confirm', `${name} certificate generated`))
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
            resolve(await writeCredential(`${name}-key.pem`, result.key))    
          })
      }
      catch (err) {
        reject(err)
      }
    })

  },
  hotelJuliet: async () => {

    return new Promise( async (resolve, reject) => {
      try {
        for (file of fs.readdirSync(config.docker.bindings.private.mount.Source)) {
          fs.unlinkSync(file)
        }
        await api.shelevate(`rm /etc/docker/daemon.json`)
        await tls.genCA()
      }
      catch (err) {
        log('error', `(hotelJuliet) got high and went blind\n${err}`)
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
          log('warn', `(isSigned) no certificate for TLS: ${certFile}`)
        } else {
          log('warn', `(isSigned) ${err}`)
        }
        resolve(false)
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

  }

}
