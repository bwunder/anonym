////NPM
const chalk = require('chalk')

module.exports = (vorpal, options) => {
  ///LOCAL 
  const api = require('../lib/api')
  const config = require('../config/config.json')
  const queries = require('../lib/queries')
  
  let torials = ['catalog', 'image', 'issql', 'go', 'run', `sqlcmd`]
  vorpal.command('test <torials>', chalk`Testorial extention
  Currently Defined Test Torials:
  \t{bold.italic ${torials}}
  A query with a syntax error is included in the query store: 'badSyntax'. (hint: SELECT is misspelled)
  Add a query to the store by putting the query into the Batch cache and then trying {bold.italic query add}  
  Queries can be edited through a variety of ${api.roygbv} options. Any editor on the local host host that 
  reads and writes UTF-8 can be used directly on the queries.js source file (see below) at an time. The cli.editor 
  and cli.ide values are user configurable references in config.json to external local editors.
  From the ${api.roygbv} prompt, choose the durability of change appropriate to the circumstances to help determine 
  the preferred method of editing a query:   
    * Clear the cache {bold.italic batch reset}, and retype the query with corrections (least durability)
    * Correct the query in cache {bold.italic batch edit} leaving the store unchanged (low durability) 
      One test cycle iteration will not see a cache edit done by the user or by another test cycle.  
    * Edit the query in the store {bold.italic query edit} (good durability)
    * Enshrine store edits to improve durability by overwriting queries.js with the query store {bold.italic query sync}      
    * Edit the 'queries.js' source file {bold.italic query edit} and then import {bold.italic query import} (best durability).`)
    .autocomplete(torials)
    .action((args, cb) => {  // extension returns no prompt when no callback in the command.action
      let saveForReset = config.cli.alwaysCheckSyntax 
      config.cli.alwaysCheckSyntax = true     
      try {
        switch (args.torials) {
        case ('issql'):
          api.log('test', chalk`Push query into cache\ntest > {cyan.bold query ${args.options.query || 'sqlVersion'}}`)
          // side effect --query autocomplete always fires
          vorpal.execSync(`query ${args.options.query || 'sqlVersion'}`)
            .then(async() => {
              api.log('test', chalk`Show Batch cache.\ntest > {cyan.bold batch}`)
              await vorpal.execSync('batch')
            })  
            .then(async() => {
              api.log('test', chalk`Check tSQL syntax\ntest > {cyan.bold issql}`)
              await vorpal.execSync('issql')
            })  
            .then(async() => {
              api.log('test', chalk`Show Batch in cache after issql ({bold.italic ?} is ${api.roygbv} alias for {bold.italic batch})\ntest > {cyan.bold ?}`)
              await vorpal.execSync('?')
            })  
            .then(async() => {
              api.log('test', chalk`Submit the query using mssql.Request.query\ntest > {cyan.bold go}`)
              await vorpal.execSync('go')
            })  
            .then(async() => {
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
            .catch( (err) => {
              api.log('error', chalk`(test) 'issql' test cycle failure\n${api.format(err)}`)
            })
          break
        case ('go'): 
          api.log('test', chalk`Push query {cyan.bold query ${args.options.query || 'databases'}} into cache\ntest > `)
          vorpal.execSync(`query`)
            .then(async() => {
              api.log('test', chalk`Show Batch cache.\ntest > {cyan.bold batch}`)
              await vorpal.execSync('batch')
            })  
            .then(async() => {
              api.log('test', chalk`Submit the query using mssql.Request.query (In the tests extension, TSQL syntax
                is always checked before exec - config.cli.alwaysCheckSyntax is forced to true)\ntest > {cyan.bold go}`)
              await vorpal.execSync('go')
            })  
            .then(async() => {
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
            .catch( (err) => {
              api.log('error', chalk`(test) 'go' test cycle failure\n${api.format(err)}`)
            })
          break       
        case ('run'): 
          api.log('test', chalk`Push query into cache\ntest > {cyan.bold query ${args.options.query || 'badSyntax'}}`)
          vorpal.execSync(`query ${args.options.query || 'badSyntax'}`)
            .then(async() => {
              api.log('test', chalk`Show Batch cache.\ntest > {cyan.bold batch}`)
              await vorpal.execSync('batch')
            })  
            .then(async() => {
              api.log('test', chalk`Submit the query using mssql.Request.batch\ntest > {cyan.bold run}`)
              await vorpal.execSync('run')
            })  
            .then(async() => {
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
            .catch( (err) => {
              api.log('error', chalk`(test) 'run' cycle failed\n${api.format(err)}`)
            })
          break  
        case('catalog'):
          api.isHost()
            .then(async() => {
              api.log('test', chalk`View the catalog summary\ntest > {cyan.bold.italic catalog summary}`)
              await vorpal.execSync(`catalog summary`)
            })
            .then(async() => {
              api.log('test', chalk`View any container from the catalog\ntest > {cyan.bold.italic catalog container}`)
              await vorpal.execSync(`catalog container`)
            })
            .then(async() => {
              api.log('test', chalk`Referring back to the summary, View the image of the Target Instance\ntest > {cyan.bold.italic catalog image}`)
              await vorpal.execSync(`catalog image`)
            })
            .then(async() => {
              api.log('test', chalk`View localhost ports and host's Docker IP vlan bridge connection details\ntest > {cyan.bold.italic catalog network}`)
              await vorpal.execSync('catalog network')
            })
            .then(async() => {
              api.log('test', chalk`Again referring to the summary, View the Target pool\ntest > {cyan.bold.italic catalog pool}`)
              await vorpal.execSync('catalog pool')
            })
            .then(async() => {
              api.log('test', chalk`Refresh the catalog with a Docker API traversal\ntest > {bold.italic catalog remap}`)
              await vorpal.execSync('catalog remap')
            })
            .then(async () => {
              api.log('test', chalk`Review the catalog summary (summary happens to be command default so ok to omit)\ntest > {bold.italic catalog}`)
              await vorpal.execSync(`catalog`)
            }) 
            .catch((err) => {
              api.log('test', chalk`(test) 'catalog' test cycle failure\n${api.format(err)}`)
            })
          break
        case('image'):
          api.isHost()
            .then(async(isHost) => {  
              if (isHost) {
                api.log('test', chalk`Show the catalog index before any testing\ntest > {cyan.bold.italic catalog}`)
                await vorpal.execSync('catalog')
              }
            })  
            .then(async() => {  
              api.log('test', chalk`Referring to the catalog index above, Show the latest image\ntest > {cyan.bold.italic image object}`)
              await vorpal.execSync('image object')
            })  
            .then(async() => {  
              api.log('test', chalk`Show all available images\ntest > {cyan.bold.italic image list}`)
              await vorpal.execSync('image list')
            })  
            .then(async() => {  
              api.log('test', chalk`Use the image command default (no args gets image of the Target)\ntest > {cyan.bold.italic image}`)
              await vorpal.execSync('image')
            })  
            .then(async() => {
              api.log('test', chalk`{bold.italic image pull} and {bold.italic image run} are tested at the prompt.
              This are long running non-blocking processes and both rely upon proper configuration before they run. 
              Testing automation is not effective for the scenarios`)
              await vorpal.execSync(`catalog`)
              return
            }) 
            .catch((err) => {
              process.stderr.write(`image test error.\n${err.stack}`)
            })
          break 
        } 
      } 
      catch(err) {
        api.log('test', chalk`{red.bold \u274E} test command failed\n${api.format(err)}`)
      }
      config.cli.alwaysCheckSyntax = saveForReset
      cb()
    })    
 
}    