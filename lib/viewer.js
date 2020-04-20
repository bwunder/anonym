////NPM
// ansi-to-html
const chalk = require('chalk-pipe')
const hljs = require("highlight.js/lib/highlight")
const Entities = require('html-entities').AllHtmlEntities
const marked = require('marked')
////CORE
const path = require('path')
////LOCAL
const { fileToJSON, jsonToFile } = require('../lib/api')
const { format, log } = require('../lib/log')

const config = require('../config/config.json')
const { name, description, version } = require('../package.json')

const entities = new Entities()

hljs.registerLanguage('bash', require('highlight.js/lib/languages/bash'))
hljs.registerLanguage('javascript', require('highlight.js/lib/languages/javascript'))
hljs.registerLanguage('sql', require('highlight.js/lib/languages/sql'))
hljs.registerLanguage('xml', require('highlight.js/lib/languages/xml'))

const restyle = (chalkMarks, out='cli') => {
  let styles = []
  let marks = chalkMarks.substring(1,chalkMarks.indexOf(' ')).split('.')
  let content = chalkMarks.substring(chalkMarks.indexOf(' ')+1, chalkMarks.length-1)
  if (out==='cli') {
    if (marks.indexOf('sub')>0) marks.indexOf('sub') = 'dim'
    //content = content.replace('&gt;', view.delimiter)
    return !marks? content: chalk(marks.join('.'))(content)
  }  
  if (out==='www') {
    if (content.length>content.trim().length) {
      content.replace(' ', '&nbsp;')
      // styles.push(`display: inline-block;`)
      // styles.push(`width: ${content.length}pc;`)
    }
    // chalk says, "style[ fn params]s (rgb(), hsl(), keyword(), etc.) may not contain spaces between params"
    for (let mark of marks) {
      switch(mark) {
        case (`bgMagenta`):
          styles.push(`color: #6600CC;`)
          break
        case (`blue`):
          styles.push(`color: #000066;`)
          break
        case (`blueBright`):
          styles.push(`color: #0000CC;`)
          break
        case (`bold`):          
          styles.push(`font-weight: bold;`)
          break
        case (`cyan`):
          styles.push(`color: #00CCCC;`)
          break
        case (`dim`):
          styles.push(`filter: brightness(50%);`)
          break
        case (`green`):
          styles.push(`color: #006600;`)
          break
        case (`greenBright`):
          styles.push(`color: #00CC00;`)
          break  
        case (`inverse`):
          styles.push(`background-color: #CCCCCC;`)
          styles.push(`color: #333333;`)
          break
        case (`italic`):
          styles.push(`font-style: italic;`)
          break
        case (`orange`):
          styles.push(`color: #FF6600;`)
          break
        case (`red`):
          styles.push(`color: #CC0000;`)
          break
        case (`redBright`):
          styles.push(`color: #FF0000;`)
          break
        case (`rgb(153,255,51)`):
          styles.push(`color: #99FF33;`)
          break  
        case (`rgb(255,136,0)`):
          styles.push(`color: #FF6600;`)
          break  
        case (`rgb(255,255,0)`):
          styles.push(`color: #FFFF00;`)
          break  
        case (`sub`):
          styles.push(`font-size: 12px;`)
          break  
        case (`underline`):
          styles.push(`text-decoration: underline;`)
          break
        case (`yellowBright`):
          styles.push(`color: #FFDD00;`)
          break
        default: 
          break        
      }
    }
    return `<span style="${styles.join('')}">${content}</span>`
  }  
}

const ucons = new Map()
const mapUcons = async () => {
  let style, ucon
  for (let key of Object.keys(config.cli.ucons)) {
    if (config.cli.ucons[key].style) {
      ucons.set(key, chalk(config.cli.ucons[key].style)(String.fromCodePoint(config.cli.ucons[key].codepoint)))
    } 
    else if (ucon) ucons.set(key, ucon)
    else ucons.set(key, '') // log and progress are blank
  }
}
mapUcons()
const TAB = out => restyle(`{${config.cli.ucons['tab'].style} ${String.fromCodePoint(config.cli.ucons['tab'].codepoint)}}`, out)

module.exports = view = {
  dft: out => restyle(`{dim.bgMagenta default}`, out), 
  descr: out => restyle(`{italic ${description}}`, out),
  delimiter: `${name} >`,
  introduction: async (cmds, out) => {
    let term=[]
    let app = view.name(out)
    let tab = TAB(out)
    cmds.forEach( cmd => {
      switch(true) {
      case(['go', 'run', 'sqlcmd', 'stream', 'issql'].includes(cmd._name.toLowerCase())):
        term.push(restyle(`{bold.inverse ${cmd._name.padEnd(15, ' .')}}`, out)+` ${cmd._description.split('\n')[0]}`)
        break
      default:
        break
      }
    })
    return `## Self-contained power user's clone of a multi-node or distributed SQL data environment.
    Architects, analysts, administrators, top developers and other thinkers wishing to design, 
    develop, modify or otherwise study private functional clones of multi-node and well connected 
    data architectures that include one or more Microsoft SQL Servers in a Linux environment, yet 
    keep your work fully insulated from any external network(s) that may or may not be connected to 
    the ${app} host. 
    
    Internet, cloud and otherwise partitioned relational architectures are as suitable to this 
    abstraction as are SQL-Graph, JSON column stores and the myriad of other edgy data technologies 
    and even ugly old monolithic transactional and analytics SQL Server data resources.
    
    ## ${app} implies anonymity and autonomy. 
    
    As directed in the config.json settings, the app can provide bi-directional ${restyle(`{italic on the wire}`, out)} 
    encryption under a server-signed Transpot Layer Security (TLS) applied, at user discretion, to 
    the Docker API web service, the SQL Server Tedious.js middleware, SQLCMD 'ODBC' command line and 
    SQLPad Express web server - when enabled. 
    
    Run-time autonomy is equally as important. Best autonomy is achieved when no depenencies are 
    established to external resources. Especially external data sources that are not - and should 
    not - be managed by the ${app}. Toward that end, an easily rotated self-signed server scoped 
    OpenSSL Certificate Authority (CA) signature is used to thwart external access to the ${app}. 
    
    In reality, mechanisms will almost always be needed to bring external data into the clone
    
    ${restyle(`{italic a la carte}`, out)} ${app} cryptographic tooling includes many selections, 
    though none are mandatory and none are in use by default. Choose among:        

        - TLS with OpenSSL Certificates signed by our private self-signed 'CA'  
            - Obfuscate the Docker API with TLS
            - Obfuscate TSQL queries and results in flight with TLS for TDS & ODBC 
            - Authenticate Docker API and SQL Server Clients to better harden the perimeter 
        - Client-side cell encryption to obfuscate persisted secrets in Nedb 
        - The OS's Full Disk, file or Block Device Encryption to protect data at rest 
        - SQL Server Encryption hierarchies fully available though not CLI dependencies.    
    
    The ${app} name also suggests to some that there will be little for you to do. In a small 
    way that is correct. SQL Server comes preinstalled in a reusable dockerhub image. There will 
    be no SQL Server installs necessary before you restore the data you have and get to the task 
    at hand. Spin up the containers you need, run your data restores/rollbacks or recoveries, 
    ideally from the scripts a "Build Master" has prepared and shared to all developers, 
    then set your database and virtual network configurations - also from her script(s) - and 
    away you go: 

        - (Re)Configure your virtual network any time 
        - Deploy data store containers from the [docker hub](https://hub.docker.com)
            - In addition to commands, the CLI speaks T-SQL, Nedb's Mongo dialect, JSON & bash 
                - Made for use with the release images Microsoft pushes to docker hub
                - Run the CLI's resevoir of SQL scripts and queries on any hosted SQL Container.
                - Run bash on the host or in a container of your choosing 
            - Add new commands at your pleasure 
            - Integrate other tools as desired/required     
            - Fork the github project and customize ${app} to your exact needs
        - Simultaneously run the SQL Servers you need to do your work locally on your laptop
            - 10+ SQL 2019 RTM Containers can run using the default config on an i5 w/8GB*  
            - Linux hosted Containers share well and can be made to overcome problems on the fly 
            - Docker CE's virtual networking will simulate real world network data paths   
            - Two query paths to each SQL Server: VNET IP & Docker assigned socket on the host  
            - Shared Host Folders in each SQL Container: for backups, private and staging
            - Each SQL Server is an independent instance: stand-alone and fully configurable
        - Technical User Productivity Sandbox for SQL Server
            - Design, develop and test SQL Graph, SSIS, partitioning/sharding schemes, etc.    
            - When necessary, just "pick it up and go". Essential for travel and remote work.
            - Magnify the anonymity of the contained v-net along with TLS
            - Plumb to a github repo to add secure source copy piece-of-mind         

        * Memory exhaustion can be a problem under load. The SQL Server configuration in the 
        image needs very little RAM when there is no load. But an aggregation or table scan 
        could more easily thrash the host into a memory crisis:          
            |:------------------------------ |: ----------------------------- |  
            | name: 'min server memory (MB)' | name: 'max server memory (MB)' |
            | maximum: 2147483647            | maximum: 2147483647            |
            | value_in_use: 16               | value_in_use: 2147483647       | 
            | is_dynamic: true               | is_dynamic: true               |  
              ----------------------------------------------------------------- 

      ${app} ${view.descr(out)}
      And select dependent NPM packages from other authors, for example:
          * ${restyle(`{bold chalk}`, out)} "Terminal string styling done right"
          * ${restyle(`{bold dockerode}`, out)} "Not another Node.js Docker Remote API module."
          * ${restyle(`{bold external-editor}`, out)} "A node module to edit a string with users preferred text editor..."
          * ${restyle(`{bold mssql}`, out)} "Microsoft SQL Server client for Node.js" 
          * ${restyle(`{bold nedb}`, out)} "The JavaScript Database" 
          * ${restyle(`{bold pem}`, out)} "Create private keys and certificates with node.js"
          * ${restyle(`{bold simpleGit}`, out)} "A light weight interface for running git commands in ...[node.js]" 
          * ${restyle(`{bold vorpal}`, out)} "Conquer the command-line"

      Input at the cli prompt is [pre-]processed line by line as entered. Each input line is 
      recognized as one of: 

          - a CLI command and then immediately processed by the CLI 
          - a ${restyle(`{bold bash}`, out)} one-off when line begins with ${restyle(`{bold ALT+b}`, out)} and immediately processed 
          - SQL text that is appended to an edit-able client-side ${restyle(`{bold batch}`, out)} cache buffer array. 
              
      CLI commands are case sensitve regardless if SQL Server is configured as case sensitive. 
      All commands, args and options are lower case. An UPPERCASE, camelCase or MiXedCaSe first 
      word after the prompt will force the line into the Batch cache. Note that only 
      the ${restyle(`{bold.inverse run}`, out)} or ${restyle(`{bold.inverse sqlcmd}`, out)} 
      CLI commands can process a batch that includes upper or mixed case ${restyle(`{bold GO}`, out)} or ${restyle(`{bold usE <db>}`, out)} 
      directives. While technically TSQL, these directives are fully consumed at the CLI before 
      subsequent pool connections are opened to the targeted SQL Server Instance. 

      Any time the user is uncertain a query is valid TSQL, the ${restyle(`{bold.inverse batch issql}`, out)} command can be used 
      to compile and submit the cache for parsing on a SQL Server without query execution, loss 
      or change to the cached query text. For maximum data safety the Terminating commands,  
          anonym> ${restyle(`{bold.inverse go}`, out)} 
          anonym> ${restyle(`{bold.inverse run}`, out)}
          anonym> ${restyle(`{bold.inverse sqlcmd}`, out)}
          anonym> ${restyle(`{bold.inverse stream}`, out)}, 
      can be configured to always include a non-terminating pre-parse test of the batch before 
      query execution by setting the ${restyle(`bold config.mssql.pool.parseJSON}`, out)} key in ${restyle(`{bold ../config/config.json}`, out)} to 
      ${restyle('{blue true}', out)}. If this implicit pre-parsing is requested and detects invalid TSQL, then the 
      parsing error is shown at the command prompt and the cache will not be subsequently 
      submitted for execution thus protecting database data from bad syntax and typographical 
      mistakes.   
      
      The cache, for example, can be viewed with the ${restyle(`{bold.inverse batch}`, out)} command or by using it's ${restyle(`{bold.inverse ?}`, out)} alias. 
      If one allows '${tab}' to represent the pressing of the TAB key, then any of the following
      commands are synonyms. All invoke the same clearing of all lines from the Batch cache:
          anonym> ${restyle(`{bold.inverse batch reset}`, out)}
          anonym> ${restyle(`{bold.inverse b${tab} r${tab}}`, out)}
          anonym> ${restyle(`{bold.inverse ? r${tab}}`, out)} 
          anonym> ${restyle(`{bold.inverse ? res${tab}}`, out)}

      and if the user cannot recall the argument name(s) for a command, all can be previewed using:
          anonym> ${restyle(`{bold.inverse ? ${tab}${tab}}`, out)}

      Notice that the alias, all options and all args are disclosed in the output from ${restyle(`{bold.inverse batch --help}`, out)}.  
      Be aware that ${restyle(`{bold.inverse ?}`, out)} is the only alias configured for the CLI out of the 
      box. The user can add other aliases (in module: '${restyle(`{bold ${path.resolve('lib/commands.js')}}`, out)}') and is trivial. 
      You could copy the ${restyle(`{bold.inverse batch}`, out)} commands implementation of the ${restyle(`{bold.inverse ?}`, out)} alias or refer to the 
          ${restyle(`{bold [Vorpal README]}`, out)}(${path.resolve('node_modules/vorpal/README.md')}) 

      For more details, review the source and/or see the repo's wiki: 
          [${restyle(`{bold Vorpal wiki}`, out)}](https://github.com/dthree/vorpal/wiki).  
      
      Two 'tabs' adjacent (e.g., '${tab}${tab}') will preview all possible context appropriate 
      autocompletions. Some examples: 

            anonym >
            anonym > ${tab}${tab}
          ${restyle(`{italic two tabs show all choices, in this case all commands}`, out)}
                  ?         about        batch        catalog      certificate  container    engine
              exit         files        go           help         history      image        log          
              query        quit         run          script       settings     sqlcmd       sqlpad       
              stream       use          
          ${restyle(`{italic The command-line reappears exactly as when the tabs were entered}`, out)}
            anonym >
          ${restyle(`{italic enter the first character(s) of a command and then one tab}`, out)}
            anonym > a${tab}
          ${restyle(`{italic and the command autocompletes (on same line) and awaits user action}`, out)}
            anonym > about

          ${restyle(`{italic enter two tabs right after two dashes to see all options}`, out)}
            anonym > about --${tab}${tab}
              --browser  --edit
            anonym > about --

          ${restyle(`{italic enter the first character(s) of a valid unique option and one tab}`, out)}
            anonym > about --b${tab}            
            anonym > about --browser             

          ${restyle(`{italic enter a space and two tabs to see all possible arguments}`, out)}
            anonym > about --browser ${tab}${tab} 
              commands  editor  ucons  readme  sqlcmd  tests  tls  usage  version

          ${restyle(`{italic enter character(s) and two tabs to filter the choices on the first characters}`, out)}
            anonym > about --browser t${tab}${tab} ...
              tests  tls
            anonym > about --browser t 
          
          ${restyle(`{italic enter character(s) that identify a unique choice and one tab to autocomplete}`, out)}
            anonym > about --browser te${tab} 
            anonym > about --browser tests 
          
          ${restyle(`{italic Hit Enter (at any time) to process the command}`, out)}
        
      Enter white space between the command and the tabs to get to the argument autocompletes. My 
      instinct is to hit the TAB key again when nothing happens after the '${tab}${tab}' which is a 
      satisfactory injection of the needed white space. For option autocompletes, the two dashes 
      are needed after the white space, just before the tabs, no whitespace in between, in order 
      to preview the choices.


      ALT key codepoints are exploited as a user convenience. When having to type the first three 
      or four characters of a command before TAB autocomplete sees a unique command is too 
      annoying, ALT key "shortcuts" to the rescue. For example, instead of having to type "cont", 
      with, after each keystroke, a more frantic probe of the TAB autocomplete facility until at 
      last the line autofills to "container", the user can simply hit ${restyle(`{bold.inverse ALT+c}`, out)} at a new prompt line 
      to prefill "containter" or ${restyle(`{bold.inverse ALT+n}`, out)} to prefill "connection". This creates is a  
      spelling conflict in the menu of commands that lasts for three characters so are the only 
      ALT keys now plumbed as prefills. The usee is then prompted to select
      from among the host and the currently running containers as the target of the shell command. 
      This is a familar sequence in other CLI commands: the user is prompted to choose from 
      among the host, the appropriate SQL containers, the images on hand or the connected pools
      after entering the command in circumstances where choices from a targeted collection are 
      possible. 

      **The ${restyle(`{bold.inverse --help}`, out)} output for all commands is assembled by Vorpal code. Notice in the options 
      example above that ${restyle(`{bold.inverse --help}`, out)} never appears in the autocomplete preview and, likewise, 
      ${restyle(`{bold.inverse --h${tab}}`, out)} does not autocomplete. 
      
      Like the ${restyle(`{bold.yellowBright Terminating}`, out)} commands, ${restyle(`{bold.inverse batch issql}`, out)} may compile the cache. Although, the latter
      command will submit the batch to a SQL Server Instance for a non-executing pre-parse TSQL 
      validation by wrapping the query in ${restyle(`{bold SET NOEXEC ON}`, out)}. However, only the Terminating 
      commands will be subsequently submitted for execution at targeted SQL Server when the pre-
      parse succeeds or is not enabled. In all scenarios, errors returned from the database by the 
      pre-parsing step will halt execution after displaying the error and will hold the query in 
      cache for user disposition. Permissions or invalid object references are not checked by the 
      SQL Server precompiler so can still result in mid-script faults that can corrupt data sets.  
      
      Any other CLI Commands and ${restyle(`{bold.inverse ALT+b}`, out)} prefixed bash commands can be entered at any new line, 
      regardless if the ${restyle(`{bold.inverse batch}`, out)} cache holds text. Commands that do not use this cache do not affect 
      cache content. Only the ${restyle(`{bold.yellowBright Terminating}`, out)} commands, and commands:
          anonym > ${restyle(`{bold.inverse query}`, out)} 
          anonym > ${restyle(`{bold.inverse script}`, out)}  
          anonym > ${restyle(`{bold.inverse batch}`, out)} 
      use and, thus, may incite the behaviors of this cache.
      
      Only the ${restyle(`{bold.yellowBright Terminating}`, out)} and the ${restyle(`{bold.inverse ? issql}`, out)} commands will send the cache to the target 
      SQL Server's Query Engine 
      \t-${term.join('\n\t-')}
      
      ***Should the first word of a valid TSQL line in the cache conflict with a command name, the 
      command has precedence and will be invoked when the line is entered. To work around the 
      restriction: 
      1. re-format the query using ${restyle(`{bold.inverse batch edit}`, out)} to avoid the start of line conflict 
      2. put the query in a script file and submit with ${restyle(`{bold.inverse run}`, out)} or ${restyle(`{bold.inverse sqlcmd}`, out)} command.\n`
  },
  header: out => {
    return `${out==='www'? '# ': ''}${view.version(out)}\n${out==='www'? '## ': ''}${view.descr(out)}\n`
  },  
  highlightSource: async (sourcePath, source) => {
    let doc = path.resolve(config.cli.docs.path, 'html', path.basename(sourcePath).concat('.html'))
    if (!source) source = await api.fileToJSON(sourcePath)
    return api.jsonToFile(`<html>
      <head>
        <title>${doc}</title>
        <link rel="stylesheet" href="../node_modules/highlight.js/styles/${config.browser.style}.css">
      </head>
      <body>
        ${await hljs.highlightAuto(source).value}
      </body>
    </html>`, doc)
    .then(() => doc)
  }, 
  markup: async (sourcePath, markdown) => {
    const doc = path.format({
      dir: path.resolve(config.cli.docs.path, 'html'),
      name: path.extname(sourcePath)? path.basename(sourcePath).replace(path.extname(sourcePath), ''): path.basename(sourcePath), 
      ext: '.html' 
    })
    const head = `<!DOCTYPE html>
    <html>
      <head>
        <title>${doc}</title>
        <link rel="stylesheet" href="../node_modules/highlight.js/styles/${config.browser.style}.css">
        <style>
          a {
            color: #33CCCC;
          }
          body { 
              font-family: Arial, Helvetica, sans-serif;
              font-size: 16px;
              color: #CCCCCC;
              background-color: #333333
          }
          .outer {
            display: inline-block; 
            width: 800px;
          }
          #source {
            font-size: 12px;
          }  
        </style>
      </head>`
console.log(`head:\n${head}\n${entities.encode(head)}`)      
    await api.jsonToFile(`
      ${entities.encode(head)}
        <body>
          <div class="outer">
            <div>
              ${sourcePath.endsWith('.md')? '': marked(view.header('www'))}
              <span id="source">sourcePath: ${sourcePath}<span>
            </div>
            ${marked(!markdown? await api.fileToJSON(sourcePath) : markdown)}
          </div>  
        </body>
      </html>`, doc)
    return doc
  },
  name: out => restyle(`{bold ${name}}`, out),
  quickstart: async (out='cli') => {
    let h3 = out==='www'? '### ': '' 
    let t1 = TAB(out)
    let t2 = `${t1}${t1}`
    return `${h3}${restyle(`{bold Multiple help Options}`, out)}

      ${restyle(`{bold.inverse  ${view.delimiter} ${'help'.padEnd(20)}}`, out)}  All Commands with descriptions 
      ${restyle(`{bold.inverse  ${view.delimiter} ${'help [CLI command]'.padEnd(20)}}`, out)}  Command with description & options (same as ${restyle(`{bold.inverse [command] --help}`, out)})
      ${restyle(`{bold.inverse  ${view.delimiter} ${'[CLI command] --help'.padEnd(20)}}`, out)}  Command with description & options (same as ${restyle(`{bold.inverse help [command]}`, out)})
      ${restyle(`{bold.inverse  ${view.delimiter} ${'--help'.padEnd(20)}}`, out)}  This Quickstart document (same as ${restyle(`{bold.inverse about quickstart}`, out)})
      ${restyle(`{bold.inverse  ${view.delimiter} ${'about quickstart'.padEnd(20)}}`, out)}  This Quickstart document (same as ${restyle(`{bold.inverse --help}`, out)})
      ${restyle(`{bold.inverse  ${view.delimiter} ${'about tls -e'.padEnd(20)}}`, out)}  Opens the tls markdown doc in configured IDE (now '${config.ide}') for edit 
      ${restyle(`{bold.inverse  ${view.delimiter} ${'about -b readme'.padEnd(20)}}`, out)}  Mark-up and Open file '../${restyle(`{bold ${name}}`, out)}/README.md' in configured browser 
    
    Review description including all available arguments and options of the ${restyle(`{bold.inverse about}`, out)} command   

      ${restyle(`{bold.inverse  ${view.delimiter} ${'help about'.padEnd(20)}}`, out)}
      - or -
      ${restyle(`{bold.inverse  ${view.delimiter} ${'about --help'.padEnd(20)}}`, out)} 

  ${h3}${restyle(`{bold Local SQL Server Container Lifecycle Management}`, out)} 

    Custom Image, Container and virtual network configurations may be set before each ${restyle(`{bold.inverse ${`image run`}}`, out)}   

      ${restyle(`{bold.inverse  ${view.delimiter} ${`settings config`.padEnd(20)}}`, out)} Open './config/config.json' in configured editor ('${config.editor}')   

    Control the Docker Container Instance Engine's daemon. 
      
      ${restyle(`{bold.inverse  ${view.delimiter} ${`engine start`.padEnd(20)}}`, out)}  Start the Docker Container Engine Instance
      
    Review the Inventory of local SQL Server Docker containers any time.   

      ${restyle(`{bold.inverse  ${view.delimiter} ${`catalog`.padEnd(20)}}`, out)}  View a terse summary of cataloged items 

    Pull a tagged 'official' SQL Server image from hub.docker.com, configured tag is '${config.mssql.repo.tag}'.  

      ${restyle(`{bold.inverse  ${view.delimiter} ${`image pull`.padEnd(20)}}`, out)}  Fetch '${config.mssql.repo.path}' from dockerhub 

    Any number of container's can be created from any local image.  

      ${restyle(`{bold.inverse  ${view.delimiter} ${`image run`.padEnd(20)}}`, out)}  Create SQL Server Instance Container from a local image 

    Any SQL Instance can be set as the target for CLI queries (Restricted to one target at a time).  

      ${restyle(`{bold.inverse  ${view.delimiter} ${`container target`.padEnd(20)}}`, out)}  Target CLI queries at an existing SQL Server Container         

    At any time, idle instance can be started or running instances can be stop or restarted  

      ${restyle(`{bold.inverse  ${view.delimiter} ${`container start`.padEnd(20)}}`, out)}  Start an Idle SQL Server Instance Container  
 
    TSQL can be added to the Batch cache  

      ${restyle(`{bold.inverse  ${view.delimiter} ${`t-sql...`.padEnd(20)}}`, out)}  Enter valid line(s) of TSQL into the CLI's Batch cache  

    or a one-off bash command can be directed to any container or the host compute instance

      ${restyle(`{bold.inverse  ${view.delimiter} ${`ALT+b`.padEnd(20)}}`, out)}  Run input line as a bash one-off command (no affect on Batch cache)  

  ${h3}${restyle(`{bold Client Side query Store and _ad hoc_ Batch Cache}`, out)}   

    Queries may be stored in the CLI's queries collection and then loaded to Batch cache for submit

      ${restyle(`{bold.inverse  ${view.delimiter} ${`query`.padEnd(20)}}`, out)}  Load a query from host's query store into the Batch cache 

    or stored in the folder allocated ('./scripts') for TSQL script files ('.sql') then loaded to cache
    
      ${restyle(`{bold.inverse  ${view.delimiter} ${`script`.padEnd(20)}}`, out)}  Load a TSQL script from '${config.cli.scripts.path}' folder to the Batch cache
      
    or submitted directly via ${ restyle('{bold.inverse sqlcmd}', out)} with the appropiate sqlcmd switch (-i, -q or -Q).   

    
    Once cached, entry of a lower case ${restyle(`{bold.yellowBright batch terminators}`, out)} first prompts the 
    query author to choose a Target SQL Instance then submits the Batch cache to the selected Query Engine.

      ${restyle(`{bold.inverse ${view.delimiter} ${`go`.padEnd(20)}}`, out)}  Submit using mssql.query()
      ${restyle(`{bold.inverse ${view.delimiter} ${`run`.padEnd(20)}}`, out)}  Submit using mssql.batch() with firehose results
      ${restyle(`{bold.inverse ${view.delimiter} ${`sqlcmd`.padEnd(20)}}`, out)}  Submit as a sqlcmd command-line 
      ${restyle(`{bold.inverse ${view.delimiter} ${`stream`.padEnd(20)}}`, out)}  Submit using mssql.batch() with stream results

    The cache is cleared and the query logged upon successful execution. Database errors are also 
    logged at the CLI, them the query author must decide whether to edit and retry 
    
      ${restyle(`{bold.inverse ${view.delimiter} ${`batch edit`.padEnd(20)}}`, out)}  Edit Batch cache contents in the config.editor (now '${config.editor}') 

    or to reset the Batch cache. 
    
      ${restyle(`{bold.inverse ${view.delimiter} ${`batch reset`.padEnd(20)}}`, out)}  Clear all text from the Batch cache   

    ${restyle(`{bold.yellowBright Mixed or upper case terminators are simply appended to the Batch cache as T-SQL text}`, out)}.
    
  ${h3}${restyle(`{bold Non-executing Server-side Query Validation}`, out)}

    To avoid most data corrupting query errors, query validation can be submitted to the Query Engine 
    in a preprocessing step for each query submitted or can be invoked by sending the batch to the 
    chosen Query Engine for validation only with no execution step.

      - When ${restyle(`{bold config.cli.checkSyntax}`, out)} is true, queries are implicitly pre-processed for syntax 
        validations, usually in the same round-trip* to the database as the query execution if valid. 
      - Pseudo-terminate the batch with ${restyle(`{bold.inverse batch --issql}`, out)}, to validate syntax and 
        await further query author instruction with no posibility to execute or clear Batch cache.

  ${restyle(`{dim *sqlcmd batch pre-process validations are submitted via mssql.Request.query().}`, out)} 

  ${h3}${restyle(`{bold TAB Autocomplete for CLI commands}`, out)}\n 
    Autocomplete implementation is consistent across all CLI vocabulary of commands, options and 
    arguments. Pressing TAB once (here depicted as ${t1}) autofills a word when exactly one match to the 
    input already typed is available. Two TABs adjacent, ${t2} will invoke a preview of all possible 
    completions for the character(s) input. Autofill or preview for an Option requires two dashes 
    first be entered explicitly to signal the option option, (${restyle(`{bold.inverse --}`, out)}).

      ${restyle(`{bold.inverse ${view.delimiter.concat(' ').concat(t2).padEnd(20)}}`, out)}
    returns the name of every command:
      ?           about       batch       catalog     connection  container   engine      exit        
      files       git         go          help        history     image       log         query       
      quit        run         script      settings    sqlcmd      sqlpad      stream      tls         
      use

      ${restyle(`{bold.inverse  ${view.delimiter} a${t1.padEnd(20)} q${t1.padEnd(20)}}`, out)}
    fills the only matching command and argument onto the line (no-op if no or multiple matches): 
      ${restyle(`{bold.inverse  ${view.delimiter} ${'about quickstart'.padEnd(20)}`, out)}

      ${restyle(`{bold.inverse  ${view.delimiter} about ${t2}}`.padEnd(20), out)}
    returns all valid arguments to the command:
      commands  editor  introduction  quickstart  readme  sqlcmd  test  tls  ucons  usage  version 

      ${restyle(`{bold.inverse  ${view.delimiter} about quickstart --${t2.padEnd(20)}}`, out)}
      - or -
      ${restyle(`{bold.inverse  ${view.delimiter} about --${t2.padEnd(20)}}`, out)}
    returns the available options for the command (arguments do not have options):
      --browse  --edit 

    Cached query text may be submitted for syntax verification by the Target SQL Server at any time 
    without execution, however, ${restyle(`{bold.yellowBright.underline', TSQL autocompletion is not exposed at the CLI prompt}`, out)}.  
    Query Authors can find good TSQL autocomplete support in IDE's like VS code and editors like EMACS.\n  
    Develop and reuse T-SQL scripts and buffered utility queries.

      - Edit '${config.cli.scripts.filter}' files in the '${config.cli.scripts.path}' folder  
        using the app set in config.json key ${restyle(`{italic config.ide}`, out)}, currently: '${config.ide}'  
      - Cached queries are opened for edit using key ${restyle(`{italic config.editor}`, out)}, currently: '${config.editor}'  

    The distinction being: the ${restyle(`{italic config.ide}`, out)} is launched as a new and independent, non-blocking process  
    and modifies files while the ${restyle(`{italic config.editor}`, out)} blocks the node.js event loop as it modifies buffer data.
    \n`
  },
  style: (chalkMark, out='cli') => restyle(chalkMark, out),
  ucons: ucons,
  usage: (out='cli') => {
    let tab = TAB(out) 
    let txt = `USAGE: ${restyle(`{bold t-sql...}`, out )}`
    txt += ` \u2503 ` 
    txt += `${restyle(`{bold.italic ALT+b}`, out)} ${restyle(`{italic bash one-liner}`, out)}`
    txt += ` \u2503 ` 
    txt += `${restyle(`{bold.inverse command}`, out)}|startsWith${tab}| ${tab}${tab} ` 
    txt += `[${restyle(`{bold.inverse --}`, out)}[${restyle(`{bold.inverse option}`, out)}|startsWith${tab}|${tab}${tab}] `
    txt += `[${restyle(`{bold.inverse argument}`, out)}|startsWith${tab}| ${tab}${tab}]\n`
    return txt 
  },
  version: (out='cli') => restyle(`{bold ${name} ${restyle(`{sub v${version}}`,out)}}`, out),
  
}

