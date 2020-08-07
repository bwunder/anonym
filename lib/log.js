//// NPM
const chalk = require('chalk')
//// CORE
const { inspect } = require('util')
////LOCAL
const config = require('../config/config.json')
const { ucons } = require('../lib/viewer')

module.exports = log = {
  format: (input, offset=1) => {
    // offset is left start position for each output line (first line never padded)
    let output=''
    switch (typeof input) {
      case ('undefined'):
        output = 'undefined'.magenta
        break
      case ('boolean'):
        output = !input? input.red: input.green
        break
      case ('number'):
        output = input.blue
        break
      case ('string'):
        try {
          if (JSON.parse(input)) {
            output = inspect(input, config.cli.log.inspect)
          }
        }
        catch(e) {
          output = input
        }
        break
      case ('object'):
        // from here, control chars in strings are just chars in the stings, not line feeds or tabs or.... 
        switch (true) {
          case (Buffer.isBuffer(input)):
            output = input.toString()
            break
          case (Array.isArray(input)):
            input.forEach( result => {
              if (typeof result==='object') {
                output+= inspect(result, config.cli.log.inspect)
              } else {
                output+=result
              }
            })
            break
          default:
            if (input && input.recordset && input.recordsets) {
              input.recordsets.forEach( rs => {
                output += inspect(rs, config.cli.log.inspect)
              })
            } else {
              output = inspect(input, config.cli.log.inspect)
              if (offset) output = (output.split('\n')).join(`\n${' '.repeat(offset)}  `)
            }
            break
        }
        break
      default:
        output = `unexpected type ${typeof input}`.inverse
        break
      }
      return output + '\n'
  }, 
  log: (mode, data) => {
    try {
      if (ucons.has(mode)) {
        switch (mode) {
          case ('log'):
            process.stdout.write(log.format(data))
            break
          case ('progress'): 
            process.stdout.write(data)
            break
          case ('remark'):
            process.stdout.write(chalk.dim(log.format(data)))
            break
          case ('sudo'):
            process.stdout.write(chalk.magentaBright(log.format(data)))
            break
          case ('test'):
            if (process.argv.length===3 && process.argv[2]==='test') {
              process.stdout.write(`${ucons.get(mode)}  ${log.format(data)}}`)
            }  
            break
          default:
            process.stdout.write(`${ucons.get(mode)}  ${log.format(data)}`)
            break
        }
      }
    }
    catch (e) { 
      process.stdout.write(chalk`{bold.red (log) failed}  mode: ${mode} type of passed data ${typeof data}\n${e.stack}\n`)
    }
  }
}  
