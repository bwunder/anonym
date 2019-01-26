//// NPM
const chalk = require('chalk')
//// CORE
const { inspect } = require('util')
/* add to config.cli.log.inspect obj  recommended: {colors: true, depth: 3} 
    showHidden <boolean> include non-enumerable symbols and properties WeakMap and WeakSet entries. Dft false
    depth <number> number of times to recurse while formatting (max null). Dft 2
    colors <boolean> style with ANSI color codes (see Customizing util.inspect colors.) Def false
    customInspect <boolean> If false [util.inspect.custom](depth, opts) functions will not be called. Dft true
    showProxy <boolean>show target and handler objects of Proxy objects. Dft false.
    maxArrayLength <integer> max Array, TypedArray, WeakMap and WeakSet elements to include. max null, none 0 or neg, Dft 100
    breakLength <integer> Set to Infinity to sho object as a single line. Dft 60
    compact <boolean> false use true multiple properties in one line of breakLength, min reduce 16 chars Dft true
    sorted <boolean> | <Function> properties sorted true default sort else pass a compare function Dft false
    getters <boolean> | <string> 'get' inspect getters without setter, 'set' getters with setter, side effects? Dft false
*/
////LOCAL
const config = require('../config/config.json')

module.exports = log = {

  format: gi => {

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
          go = inspect(gi, config.cli.log.inspect)
        }
      }
      catch(e) {
        go = gi
      }
      break
    case ('object'):
      // from here, control chars in strings are just chars in the stings, not line feeds or tabs or.... 
      switch (true) {
      case (Buffer.isBuffer(gi)):
        go = gi.toString()
        break
      case (Array.isArray(gi)):
        gi.forEach( result => {
          if (typeof result==='object') {
            go+= inspect(result, config.cli.log.inspect)
          } else {
            go+=result
          }
        })
        break
      default:
        if (gi && gi.recordset && gi.recordsets) {
          gi.recordsets.forEach( rs => {
            go += inspect(rs, config.cli.log.inspect)
          })
        } else {
          go = inspect(gi, config.cli.log.inspect)
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
  log: (mode, data) => {

    try {
      if (['confirm', 'debug', 'error', 'info', 'log', 'progress', 'test', 'warn'].includes(mode)) {
        switch (mode) {
          case ('confirm'):
            process.stdout.write(chalk`{bold.green \u2611}  ${log.format(data)}`)
            break
          case ('debug'):
            process.stdout.write(`\u2370  ${log.format(data)}`)
            break
          case ('error'):
            process.stderr.write(chalk`{bold.red \u274E}  ${log.format(data)}`)
            break
          case ('info'):
            process.stdout.write(chalk`{bold.blue \u2B50}  ${log.format(data)}`)
            break
          case ('log'):
            process.stdout.write(log.format(data))
            break
          case ('progress'): // multiple ~1 char writes to same line, caller must terminate '\n' else messy
            process.stdout.write(data)
            break
          case ('test'):
            process.stdout.write(chalk`{rgb(153, 255, 51) ${"\u{1F50E}"}  ${log.format(data)}}`)
            break
          case ('warn'):
            process.stdout.write(chalk`{bold.yellow \u2621}  ${log.format(data)}`)
            break
          default:  //log
            process.stdout.write(log.format(data))
            break
        }
      }
    }
    catch (e) { 
      process.stdout.write(chalk`{bold.red (log) failed}  mode: ${mode} type of passed data ${typeof data}\n${e.stack}\n`)
    }

  }

}  