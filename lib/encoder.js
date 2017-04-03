#!/usr/bin/env node
"use strict;"
//core
const crypto = require('crypto');
const path = require('path');
const util = require('util');
// NPM
const jwt = require('jsonwebtoken');
//const merkle = require('merkle');
const merkleGenerator = require('merkle-tree-stream/generator'); //try to use this  instead of merkle
const merkleStream = require('merkle-tree-stream');
// local
const log = require('../lib/logger')( "encoder");
const { root, snapshots, vfs } = require('./vmap');
// internal
const signOptions = { algorithm: 'RS512' };
//const checksumOptions = { algorithm: 'SHA256' };
const snaps = path.join(root, snapshots);
const privateSigningPem = path.join(root,'/private/signRSAPrivateKey.pem');
const publicSigningPem = path.join(root, 'public/keys/signRSAPublicKey.pem');

const leaf = (leaf, roots)=>crypto.createHash('sha256').update(leaf.data).digest();
const parent = (a, b)=>crypto.createHash('sha256').update(a.hash).update(b.hash).digest();
const gen = merkleGenerator({leaf, parent});
const stream = merkleStream({leaf, parent});

const fnInspector = function(depth) {
  let inciter = this;
  let texts={};
  Object.keys(this).forEach( function(api) {
    texts[api] = inciter[api].toString();
  });
  return texts;
};

const indexJSON = function(obj, roots) {
  stream.write(util.inspect(obj, { depth: null, showHidden: true }));
}

stream.on('data', function (data) {
  console.log(`encoder.js merkle stream data event id:${data.index}, parent;${data.parent}, \ndata:${(!data.data)?'null': data.data.toString().substr(1,100)}`);
});

stream.on('end', function () {
console.log('encoder.js merkle.stream has ended');
});

const checkStore = function(name, store) {
  return vfs.writeFileAsync(path.join(snapshots, `${name}.json`), util.inspect(store), 'utf8')
  .then(function(){
    const hash = crypto.createHash('SHA256');
    hash.update(util.inspect(store,{ depth: null, maxArrayLength: null}));
    return hash.digest('hex');
  })
  .catch(function(err) {
    console.error(err);
  });
}

// uses placeholders and throws any symbols on the floor!
const signData = function(obj) {
  return vfs.readFileAsync(privateSigningPem)
  .then(function(PrivateKey){
      return jwt.sign(util.inspect(obj,{ depth: null, maxArrayLength: null}) , PrivateKey, signOptions);
  })
  .catch(e=>log.error('signature', e));
}

const signInterface = function(iface) {
  texts={};
  for (child in iface) {
    texts[child] = iface[child].toString();
  }
  return vfs.readFileAsync(privateSigningPem)
  .then(function(PrivateKey){
      return jwt.sign(texts, PrivateKey, signOptions);
  })
  .catch(e=>log.error('signature', e));
}

const verifySignature = function(token) {
  return vfs.readFileAsync(publicSigningPem)
  .then(function(PublicKey) {
    if (jwt.verify(token, PublicKey, signOptions)) {
      jwt.decode(token);
    };
  })
  .catch(e=>log.error('signature', e));
}

// these merke two worked
// const merkleStore = function(name, store) {
//   //  console.log("encoder.js dpiTexts", dpiTexts.length);
//   let useUpperCase = false;
//   let tree = merkle('none', useUpperCase).async(store, function(err, tree) {
// console.log("encoder.js tree", tree);
//       return tree;
//   });
// }
//
// // client is going to need to know the algorithm used too
// // unless the check is dnly done server side
// const merkleDPI = function(name, store) {
//   let dpiTexts=[];
//   // merkle tree from array of named function strings
//   for (api in store.dpi) {
//     dpiTexts.push(`${api}: ${util.inspect(store.dpi[api])}`);
//   }
// //  console.log("encoder.js dpiTexts", dpiTexts.length);
//   let useUpperCase = false;
//   let tree = merkle('none', useUpperCase).async(dpiTexts, function(err, tree) {
//       if (!store[Symbol.for('dpi')]) {
//         store[Symbol.for('dpi')] = tree;
//       } else {
//         if (!store[Symbol.for('dpi')].level(0)==tree.level(0)) {
//           throw new Warning("dpi has changed");
//         }
//       }
//   });
// }


// const encryptByPublic = function(obj, keys) {
//   // any reader of public can do this
//   // no reader of public can decode this
// }
// const encryptByPrivate = function(obj, keys) {
//   // no reader of public can do this too
//   // any reader of public can decode this
// }
// const decryptByPublic = function(cyphertext) {
//   // any reader of public can do this
//   // no reader of public can decode this
// }
// const decryptByPrivate = function(cyphertext) {
//   // no reader of public can do this too
//   // any reader of public can decode this
// }

module.exports = {
  fnInspector,
  signData,
  signInterface,
  indexJSON,
//  merkleDPI,
//  merkleStore,
  verifySignature,
  decode: jwt.decode,
  checkStore,
//  encryptByPublic,
//  decryptByPrivate,
//  encryptByPrivate,
//  decryptByPublic
}
