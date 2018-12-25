////NPM
const chalk = require('chalk')
process.stdout.write(chalk`{rgb(153, 255, 51) Tester's are referrered to the 'test.md' doc} (via command: {bold.italic about test})\n`)
module.exports = vorpal => { 
  ///LOCAL 
  const api = require('../lib/api')
  const config = require('../config/config.json')

  let torials = ['catalog', 'engine', 'image', 'issql', 'go', 'run', `sqlcmd`]
  vorpal.command('test <torials>', chalk`Test extention (Torials - {bold.italic ${torials}}`)
    .autocomplete(torials)
    .option('-s, --syntax', 'Include non-executing pre-query round trip to validate TSQL syntax by batch on target ')
    .action(async (args, cb) => {  // extension returns no prompt when no callback in the command.action
      let saveForReset = config.cli.alwaysCheckSyntax 
      if (args.options.syntax) {
        config.cli.alwaysCheckSyntax = true     
      } else {
        config.cli.alwaysCheckSyntax = false     
      }
      try {
        switch (args.torials) {
          case('catalog'):
            api.log('test', chalk`View the catalog summary\ntest > {cyan.bold.italic catalog summary}`)
            vorpal.execSync(`catalog summary`)
            .then(async() => {
              api.log('test', chalk`View any container from the catalog\ntest > {cyan.bold.italic catalog container}`)
              await vorpal.execSync(`catalog container`)
            })
            .then( async () => {
              api.log('test', chalk`Referring back to the summary, View the image of the Target Instance\ntest > {cyan.bold.italic catalog image}`)
              await vorpal.execSync(`catalog image`)
            })
            .then( async () => {
              api.log('test', chalk`View localhost ports and host's Docker IP vlan bridge connection details\ntest > {cyan.bold.italic catalog network}`)
              await vorpal.execSync('catalog network')
            })
            .then( async () => {
              api.log('test', chalk`Again referring to the summary, View the Target pool\ntest > {cyan.bold.italic catalog pool}`)
              await vorpal.execSync('catalog pool')
            })
            .then( async () => {
              api.log('test', chalk`Refresh the catalog with a Docker API traversal\ntest > {bold.italic catalog remap}`)
              await vorpal.execSync('catalog remap')
            })
            .then( async () => {
              api.log('test', chalk`Review the catalog summary (summary happens to be command default so ok to omit)\ntest > {bold.italic catalog}`)
              await vorpal.execSync(`catalog`)
            }) 
            .catch( err => {
              api.log('test', chalk`(test) 'catalog' test cycle failure\n${api.format(err)}`)
            })
          break
        case ('go'): 
          api.log('test', chalk`Load & mssql.query() a query from the query store\ntest > {cyan.bold query}`)
          vorpal.execSync(`query`)
            .then( async () => {
              api.log('test', chalk`Show Batch cache.\ntest > {cyan.bold batch}`)
              await vorpal.execSync('batch')
            })  
            .then( async () => {  
              api.log('test', chalk`Submit the query using mssql.Request.query (config.cli.alwaysCheckSyntax is ${config.cli.alwaysCheckSyntax})\ntest > {cyan.bold go}`)
              await vorpal.execSync('go')
            })  
            .then( async () => {
              api.log('test', chalk`Show that Batch is emptied and ready for next query at end of cycle\ntest > {cyan.bold ?}`)
              await vorpal.execSync('?')
            }) 
            .catch( err => {
              api.log('error', chalk`(test) 'go' test cycle failed\n${api.format(err)}`)
            })
          break       
        case ('issql'):
          api.log('test', chalk`Push query into cache\ntest > {cyan.bold query ${args.options.query || 'sqlVersion'}}`)
          vorpal.execSync(`query ${args.options.query || 'sqlVersion'}`)
            .then( async () => {
              api.log('test', chalk`Show Batch cache.\ntest > {cyan.bold batch}`)
              await vorpal.execSync('batch')
            })  

            .then( async () => {
              api.log('test', chalk`Check tSQL syntax\ntest > {cyan.bold issql}`)
              if (await vorpal.execSync('issql')===false) {
                api.log('test', chalk`The Batch remains in cache enchached when after validation, success of fail \ntest > {cyan.bold ?}`)
                await vorpal.execSync('?')
              }
            })  
            .then(async() => {
              if (api.batch.length>0) {
                api.log('test', chalk`Edit the Batch with ${config.cli.editor}
                  {yellow It is necessary to save the changes and close the editor to get back to the prompt.}`)
                await vorpal.execSync('? edit')
              }
            })   
            .then( async () => {
              api.log('test', chalk`Check tSQL syntax\ntest > {cyan.bold issql}`)
              if (await vorpal.execSync('issql')===false) {
                api.log('test', chalk`The Batch remains in cache enchached when after validation, success of fail \ntest > {cyan.bold ?}`)
                await vorpal.execSync('?')
              }
            })  
            .then( async () => {
              api.log('test', chalk`clear the query from cache\ntest > {cyan.bold batch reset}`)
              api.log('test', chalk`Show that Batch is empty as requested\ntest > {cyan.bold ?}`)
              await vorpal.execSync('?')
            }) 
            .catch( err => {
              api.log('error', chalk`(test) 'issql' test cycle ended in error\n${api.format(err)}`)
            })
          break
        case ('run'): 
          api.log('test', chalk`Load & mssql.run() a script from the scripts folder \ntest > {cyan.bold query}`)
          vorpal.execSync(`query`)
            .then( async () => {
              api.log('test', chalk`Show Batch cache.\ntest > {cyan.bold batch}`)
              await vorpal.execSync('batch')
            })  
            .then( async () => {
              api.log('test', chalk`Submit the query using mssql.Request.batch\ntest > {cyan.bold run}`)
              await vorpal.execSync('run')
            })  
            .then( async () => {
              if (api.batch.length>0) {
                api.log('test', chalk`Edit the Batch using ${config.cli.editor}
                after saving changes and exiting the editor, try 
                  {bold.italic issql} or the equiv. {bold.italic is[TAB][TAB]}  
                at the prompt, 
                and if valid follow that with 
                  {bold.italic go}  or the equiv. {bold.italic g[TAB][TAB]}
                else retry the edit
                  {bold.italic batch edit}  or the equiv. {bold.italic ? e[TAB][TAB]}`)
                await vorpal.execSync('? edit')
              } else {
                api.log('test', chalk`Show that Batch is clean at end of cycle\ntest > {cyan.bold ?}`)
                await vorpal.execSync('?')
              }  
            }) 
            .catch( err => {
              api.log('error', chalk`(test) 'run' cycle failed\n${api.format(err)}`)
            })
          break  
        case('image'):
          api.log('test', chalk`Show the catalog index before any testing\ntest > {cyan.bold.italic catalog}`)
          vorpal.execSync('catalog')
            .then( async () => {  
              api.log('test', chalk`Referring to the catalog index above, Show the latest image\ntest > {cyan.bold.italic image object}`)
              await vorpal.execSync('image object')
            })  
            .then( async () => {  
              api.log('test', chalk`Show all available images\ntest > {cyan.bold.italic image list}`)
              await vorpal.execSync('image list')
            })  
            .then( async () => {  
              api.log('test', chalk`Use the image command default (no args gets image of the Target)\ntest > {cyan.bold.italic image}`)
              await vorpal.execSync('image')
            })  
            .then( async () => {
              api.log('test', chalk`{bold.italic image pull} and {bold.italic image run} are better tested at the prompt.
              This are long running non-blocking processes and both rely upon proper configuration before they run. 
              Testing automation is not effective for the scenarios`)
              await vorpal.execSync(`catalog`)
              return
            }) 
            .catch( err => {
              process.stderr.write(`image test error.\n${api.format(err)}`)
            })
          break 
        case('sqlcmd'):
          //requires World Wide Importers sample db
          api.batch.split(0)
          api.batch.push(`exec `)
          api.log('test', chalk`execute a stored proc and show the query plan as text\ntest > {cyan.bold.italic sqlcmd -Q}`)
          break 
        } 
      } 
      catch(err) {
        api.log('test', chalk`{red.bold \u274E} test command failed\n${api.format(err)}`)
      }
      finally {
        config.cli.alwaysCheckSyntax = saveForReset
        cb()
      }
    })    
 
}    