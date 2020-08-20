//// NPM
const chalk = require('chalk')
////CORE
const path = require('path')
//// LOCAL
const { fileToJSON, shell, spawnTask } = require('../api')
const { log } = require('../log')
const view = require('../viewer')

const config = require('../../config/config.json')

module.exports = about = {
  description: chalk`Documentation by topic\n
    Choose a topic and view that info at the prompt (${view.dft()}) 
    or, include option {bold -b aka --browse} option to spawn the same text in the configured browser 
        * see {bold.italic config.browser} - currently '{italic ${config.browser.command}}'.
    or, include option {bold -e aka --edit} to open the topic's source file for edit in the
    apps explicitly set for local edits in 'config.json' : 
        * When not field configured, CLU uses host's default browser and 'vi' for edits.
        * Files are opened for edit in the user's preferred {bold.italic config.ide}, 
          currently '{italic ${config.ide}}'. CLI may require restart to see the changes. 
        * Buffer's, JSON and run-time relevant files block the event loop while open in {bold.italic config.editor}, 
          currently '{italic ${config.editor}}'. Changes are recognized by the CLI at next use.`, 
  args: {
    topic: {
      commands:     `Index of CLI commands with brief descriptions`,
      config:       `'./docs/config.md' - describes the './config/config.json' key pairs`, 
      editor:       chalk`--help command-line output of {bold.italic config.editor}`,
      introduction: `Developing Distributed Apps with ${view.name()} and Microsoft SQL Server`,   
      quickstart:   `CLI quickstart - CLI usage and some useful commands for getting started`,
      readme:       `'./README.md' file (e.g., the markdown document for the repo on github)`,
      sqlcmd:       chalk`'./docs/sqlcmdCheatSheet.html' (expands upon {bold.inverse sqlcmd -?})`,
      test:         `'./docs/test.md' - describes the test strategy and enabling the test command`,
      tls:          `'./docs/tls.md' - describes setup and use of TLS by the CLI`,
      version:      `The version from package.json`,
      ucons:        `Unicode codepoints used by CLI as symbols to inform the user at a glance`, 
      usage:        `${view.dft()} CLI usage message`
    },  
    output: {
      browser:     `Open the documentation (as HTML) in a browser with '${config.browser.command}'`,
      editor:      chalk`Edit the {italic source text file} with 'config.editor'`,
      CLI:         `${view.dft()} Display the documentation to this command-line`
    }
  },
  dispatch: async (args) => { 
    let content, doc, source
    switch (args.topic) {
      case ('commands'):
        if (args.output.browser) {
          source = [`| command | description |`, `|:---  |:--- |`]
// wish to see how inquirer stores prompts 
log('confirm', this) 
// may be a better way to get command meta?
log('info', module)
          commands.forEach( (cmd) => {
            if (cmd._name) source.push(`| __${cmd._name}__ | ${cmd._description.split('\n')[0]} |`)
          })
          doc = await view.markup(args.topic, source.join('\n'))
        }
        else if (args.output.editor) doc = path.resolve('./lib/commands/cli.js')
        else {
          content = ['\n']
// same issue re prompt storage (remove vorpal ref)
          commands.forEach( (cmd) => {
            if (cmd._name) {
              content.push(chalk`{bold ${cmd._name}}`
              .padEnd(25, ' .')
              .concat(' ')
              .concat(cmd._description.split('\n')[0])
              .concat(`\n`))
            }  
          })
        }
        break    
      case('editor'):
        source = await hell(`${config.editor} --help`)
        if (args.output.browser) {
          doc = await view.markup(`${config.editor}.help`, `<pre>${source}</pre>`)
        }
        else if (args.output.editor) doc = path.resolve('./config/config.json')
        else content = source  
        break  
      case ('introduction'):        
        if (args.output.browser) {
          doc = await view.markup('introduction', await view.introduction(commands, 'www'))
        }  
        else if (args.output.editor) doc = path.resolve('./lib/viewer.js') 
        else content = await view.introduction(commands, 'cli')
        break
      case ('quickstart'):
        if (args.output.browser) {
          doc = await view.markup('quickstart', await view.quickstart('www'))
        }  
        else if (args.output.editor) doc = path.resolve('./lib/viewer.js')
        else content = await view.quickstart('cli')
        break
      case ('readme'):
        source = path.resolve('./README.md')
        if (args.output.browser) {
          doc = await view.markup(source)
        }
        else if (args.output.editor) doc = source
        else content = await fileToJSON(source)   
        break
      case ('sqlcmd'):
        sourcePath = path.resolve('./docs/sqlcmdCheatSheet.ods')
        if (args.output.browser) doc = path.resolve(config.cli.docs.path, 'html/sqlcmdCheatSheet.html')
        else if (args.output.editor) doc = sourcePath
        else {
          content = `Review the './docs/sqlcmdCheatSheet.ods' spreadsheet with LibreOffice or 
          browse ./docs/html/sqlcmdCheatSheet.html and view the source. 
          Viewing HTML in a bash terminal is Webster's third definition of insanity.`
        } 
        break
      case('test'):
      case('tls'):
        sourcePath = path.resolve(config.cli.docs.path, `${args.topic}.md`)       
        if (args.output.browser) doc = await view.markup(sourcePath)
        else if (args.output.editor) doc = sourcePath
        else content = await fileToJSON(sourcePath)
        break  
      case ('ucons'):
        if (args.output.browser) {
          // dynamic markdown, whoo-hoo
          source =[`| intent | symbol |`, `|:--- |:--- |`]
          for (let intent in config.cli.ucons) {
            let ucon = config.cli.ucons[intent]            
            if (ucon.style) source.push(`| ${intent} | ${view.style(`{${ucon.style} ${String.fromCodePoint(ucon.codepoint)}}`, 'www')} |`)
            else if (ucon.codepoint) source.push(`| ${intent} | ${String.fromCodePoint(ucon.codepoint)} |`)
            else source.push(`| ${intent} |  |`) // log and progress are blank
          }   
          doc =  await view.markup(args.topic, source.join('\n'))       
        }  
        else if (args.output.editor) doc = path.resolve('../config/config.js')
        else {
          content = [chalk`\n${chalk.underline(`intent`).padEnd(30)} {underline symbol}\n`]
          view.ucons.forEach( (ucon, intent) => {
            content.push(intent.padEnd(25, ' .').concat(ucon).concat(`\n`))
          })
        }
        break  
      case('version'):
        if (args.output.browser) {
          doc = await view.markup('version', await view.markup('version', '\t'))
        } 
        else if (args.output.editor) doc = path.resolve('../package.json')
        else content = ''
        break  
      case('usage'):
      default:
        if (args.output.browser) {
          doc = await view.markup('usage', await view.usage('www'))
        } 
        else if (args.output.editor) doc = path.resolve('../lib/viewer.js')
        else content = await view.usage('cli')
        break
    } 
    if (args.output.browser) await spawnTask(`${config.browser.command} ${doc}`)
    else if (args.output.editor) await spawnTask(`${config.ide} ${doc}`)
    else {
      log('log', view.header())
      log('log', content)
    }  
  }
}
