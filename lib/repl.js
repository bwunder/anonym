"use strict;"
// NPM
const Promise = require('bluebird');

// core
const childProcess = Promise.promisifyAll(require('child_process'));
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
//const readline = require('readline');
//const repl = require('repl');
//const util = require('util');
const repl = require('vorpal-repl');

// local
const Switch = require('./switch.json');

// duckduckgo.search.header.@MattJohnson
function formatLocalDate() {
    var now = new Date(),
        tzo = -now.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function(num) {
            var norm = Math.abs(Math.floor(num));
            return (norm < 10 ? '0' : '') + norm;
        };
    return now.getFullYear()
        + '-' + pad(now.getMonth()+1)
        + '-' + pad(now.getDate())
        + 'T' + pad(now.getHours())
        + ':' + pad(now.getMinutes())
        + ':' + pad(now.getSeconds())
        + dif + pad(tzo / 60)
        + ':' + pad(tzo % 60);
}
// local
const query = require('./query');
const README = fs.readFileAsync('./README.md')
.then((data) => {
	return data.toString();
})
.catch((e) => console.error(e));


// batch cache
var Batch = [];           // truncated at each batch submit
const BatchHistory = {};    // just after it is persisted here
// cache of T-SQL SET statements to be prefixed to each batch/scriptfile
const Set = ['SET ARITHABORT ON','SET NOCOUNT ON']; // R-Ws have precidence over switches & dflts
const SetHistory = {};
// Switch = {};          // command line switchs to be used with values
// const login = { U: 'sa', P: '<YourStrong!Passw0rd>', S: '172.17.0.1', d: 'whozUrData' };
// login-related	  !A, !C, (d), D, E, H, K, l, M, N, (P), (S), (U)
// io               *i, r, R, u - (f is there)
// query exec       (e), I, *q, *Q, t, X, v (v is there)
// output format    (h), k, s, w, W, y, Y
// report =          b, m, V
// misc;             a, c, p, x, *?   (but switch -? would have to connect to show help)
//    secret-code-key  ()=prefilled, *=overridden in code, !=flag
//var Switch = Object.assign(login, io, exec, format, report, misc);

// commandline string from the Switch cache object
const sw = function() {
	let str='';
	Object.keys(Switch).forEach((key) => {
		if (!['i', 'q', 'Q'].includes(key)) {
			str+=` -${key}`;
			if (key!=Switch[key]) {
				str+= typeof Switch[key]=='string'? "'"+Switch[key]+"'":Switch[key];
			}
		} else {
			console.info(`switch ${key} is reserved, use ${
				(key=='i')? 'RUN filename': (key==='Q')? 'GO' : 'OPEN'}`);
		}
	});
	return str;
}

const sqlcmd = function() {
	return `sqlcmd ${sw()}`;
}

const submit = function() {

  if (/^[GO|OPEN|RUN]/i.test(Batch[Batch.length-1])) {

    let cmd = '';
    let instructor = Batch.pop();

    switch (true) {

  		case /^RUN\s[\.|\/|a-z0-9]+\.*/i.test(instructor) :
         console.log("RUN instructor",instructor);
  	 		 cmd = ` -i "` + path.join(__dirname, instructor.substr(4).trim());
         break;

  		case /^OPEN$/i.test(instructor) :
        if ( Set || Batch ) {
  				cmd = ` -q "`+ Set.join(";\n") + ';\n' + Batch.join('\n') + `";\n`;
  			}
  		  break;

  		case /^GO$/i.test(instructor) :
  			cmd = ` -Q "` + Set.join(";\n") + ';\n' +  Batch.join('\n') + '";\n';
        break;

      default:
        break;

    }
    console.log("submit cmd", cmd);

    return childProcess.execAsync(sqlcmd()+cmd)

  }

}

// init
let ts = formatLocalDate();
delete Switch.W;
//Switch.Y='Y 80'; // stretch the columns a bit?
//Batch.push(`:Listvar`);
//Batch.push(`::Listvar`);
Batch.push(`:SETVAR SQLCMDMAXFIXEDTYPEWIDTH 256\n`);
//Batch.push(`SELECT $(SQLCMDMAXFIXEDTYPEWIDTH) AS [SQLCMDMAXFIXEDTYPEWIDTH];`);
//Batch.push(`::Listvar`);
//Batch.push(`PRINT "SQLCMDPASSWORD" = "SQLCMDPASSWORD $(SQLCMDPASSWORD)"`);
// Batch.push(`PRINT "SQLCMDUSER" = "SQLCMDUSER $(SQLCMDUSER)"`);
// Batch.push(`PRINT "SQLCMDSERVER" = "SQLCMDSERVER $(SQLCMDSERVER)"`);
// Batch.push(`PRINT "SQLCMDWORKSTATION" = "SQLCMDWORKSTATION $(SQLCMDWORKSTATION)"`);
// Batch.push(`PRINT "SQLCMDSTATTIMEOUT" = "SQLCMDSTATTIMEOUT $(SQLCMDSTATTIMEOUT)"`);
// Batch.push(`PRINT "SQLCMDDBNAME" = "SQLCMDDBNAME $(SQLCMDDBNAME)"`);
// Batch.push(`PRINT "SQLCMDLOGINTIMEOUT" = "SQLCMDLOGINTIMEOUT $(SQLCMDLOGINTIMEOUT)"`);
// Batch.push(`PRINT "SQLCMDHEADERS" = "SQLCMDHEADERS $(SQLCMDHEADERS)"`);
// Batch.push(`PRINT "SQLCMDCOLSEP" = "SQLCMDCOLSEP $(SQLCMDCOLSEP)"`);
// Batch.push(`PRINT "SQLCMDCOLWIDTH" = "SQLCMDCOLWIDTH $(SQLCMDCOLWIDTH)"`);
// Batch.push(`PRINT "SQLCMDPACKETSIZE" = "SQLCMDPACKETSIZE $(SQLCMDPACKETSIZE)"`);
// Batch.push(`PRINT "SQLCMDERRORLEVEL" = "SQLCMDERRORLEVEL $(SQLCMDERRORLEVEL)"`);
// Batch.push(`PRINT "SQLCMDMAXVARTYPEWIDTH" = "SQLCMDMAXVARTYPEWIDTH $(SQLCMDMAXVARTYPEWIDTH)"`);
// Batch.push(`PRINT "SQLCMDMAXFIXEDTYPEWIDTH" = "SQLCMDMAXFIXEDTYPEWIDTH $(SQLCMDMAXFIXEDTYPEWIDTH)"`);
// Batch.push(`PRINT "SQLCMDEDITOR" = "SQLCMDEDITOR $(SQLCMDEDITOR)"`);
// Batch.push(`PRINT "SQLCMDINI" = "SQLCMDINI $(SQLCMDINI)"`);
// Batch.push(`PRINT "SQLCMDUSEAAD" = "SQLCMDUSEAAD $(SQLCMDUSEAAD)"`);

//Batch.push(`SELECT 'sql time:' AS [node time:], SYSDATETIMEOFFSET() AS [${ts}];`);
//Batch.push(`SELECT @@VERSION AS [ ];`);
//Batch.push(`EXEC xp_msver;`);
Batch.push('GO'); // instruction (overrides the default sqlcmd batch separator)

// excersize the connection during startup
submit()
.then(function(results) {
	console.info(results);
	ts = formatLocalDate();
	BatchHistory[`${ts}`] = Batch;
  Batch = [];
	Switch.e = 'e';
	Switch.h = -1;
	replServer.prompt();
})
.catch((e)=>console.error(e));

// // load cache leftovers?
// try{
//   fs.readFileSync('Batch.cache', Batch);
//   fs.readFileSync('Set.cache', Set);
//   fs.readFileSync('Switch.cache', Switch);
// }
// catch(e) {
//   console.error(e);
// }
console.dir(repl);

// const replServer = repl({
//   prompt: '..>',
//   input: process.stdin,
//   output: process.stdout
// });
// const rl = readline.createInterface({
// 	input: process.stdin,
//   output: process.stdout,
//   prompt: 't-sql  > '
// });

// command processor
repl().on('line', (newline) => {

	try{

		switch (true) {

			case (/^\?/.test(newline)) :
				let sw = '';

				switch(true) {

				 	case (/^\?$/.test(newline)) :  // ?  show batch cache
						console.info('Batch cache\n', Batch.join('\n'));
						break;

					case (/^\?\-$/.test(newline)) :  // ?  clear (init) batch cache
						Batch=[];
						console.info('cleared Batch cache');
						break;

					case (/^\?SET$/i).test(newline) :  // ?SET  show the Set cache
						console.info('Set cache', Set);
						break;

					case (/^\?\+SET\s/i.test(newline)) : // ?+SET  add/overwrite a SET statement in prefix
						if (!Set.includes(newline)) {
							Set.push(newline.substr(3).trim());
              console.info(`added switch '${newline.substr(3)}' to Set cache`);
						}
						break;

					case (/^\?\-SET\s/i.test(newline)) : // ?-SET remove a SET statement from the array

						if (Set.includes(newline.substr(3))) {
							Set.splice( Set.indexOf(newline.substr(3)), newline.substr(3).length);
              console.info(`removed switch '${newline.substr(3)}' from Set cache`);
						}

						break;

	        }

					case (/^\?\?$/.test(newline)) : // show switch cache

						console.info('sqlcmd Switch cache\n', Switch);

						break;

					case (/^\?\-[A-Z]$/i.test(newline)) : // ?-d remove switch 'd' from cache

            if (Switch[newline.substring(3)]) {
              delete Switch[newline.substring(3)];

              console.info(`removed -${newline.substring(3)} from Switch cache`);
            } else {
              console.warn(`switch ${sw} not found in Switch cache`)
            }

						break;

					case (/^\?\+[A-Z]/i.test(newline)) : // ?+U    add/overwrite switch 'U' in cache

            Switch[newline.substring(3,1)] = newline.substring(3).trim();
					  console.info(`added switch ${sw} to the Switch cache`);

						break;

  	    break;

  	  case (/^EXIT$/i.test(newline)) :
  	    replServer.close();
  	    break;

  		case (/^USE\s/i.test(newline)) :
        Batch.push(newline);
       	submit()
       	.then(function(results) {
        	login.d = newline.substr(4).trim();
  				replServer.prompt();
       	})
       	.catch((e)=>console.error(e));
       	break;

  		case (/^RUN\s/i.test(newline)) :
  			let fileName = newline.substr(4).trim();
  			console.info(`RUN ${fileName}`);
  	      Batch.push(fileName);
  			submit()
  			.then( function(results) {
  				console.info(`RUN ${fileName}\n results\n ${results}`);
  			})
  			.catch((e)=>console.error(e));
  			break;

  		case (/^OPEN$/i.test(newline)) :
  			Batch.push(newline);
  			submit()
  			.then( function(results) {
  				console.info('OPEN result\n', results);
  				Batch = [];
  			})
  			.catch((e)=>console.error(e));
  			break;

  		case (/^HELP$/i.test(newline)) :
  			console.info(README.value());
  		  break;

  		case (/^GO$/i.test(newline)) :
  			Batch.push(newline); // this gets popped b4 batch is sent to server
      	submit()
      	.then( function(results) {
  				//childProcess.execAsync(`firefox ${results}`);
  				console.info(results);
          this.displayPrompt(); // "... just a local idiot" - jBrowne
  				Batch = [];
      	})
      	.catch((e)=>console.error(e));
      	break;

  		case (/^\-\?$/.test(newline)) :
        	console.info(childProcess.execSync('sqlcmd -?').toString());
        	break;

     	default:
    		Batch.push(newline);
       	break;

      }

  }

  catch(e) {

	  console.error(e);
    process.exit(1);

  }

})

.on('close', () => {
  // persist the cache
  fs.writeFileSync('Batch.cache', JSON.stringify(Batch));
  fs.writeFileSync('Set.cache', JSON.stringify(Set));
  fs.writeFileSync('Switch.cache', JSON.stringify(Switch));

  process.exit(0);

});
