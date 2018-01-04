NOT YET IN USE (not sure it ever will be)

const Joi = require('joi');
const config = require('./config.json');

const schema = Joi.object({
    archivePath: Joi.string(),
    cache: Joi.object()({
        Batch: Joi.array().items(Joi.string()),
        BatchHistory: Joi.object()({
            Joi.date().timestamp(): Joi.array().items(Joi.string())
        }),
        Prefix: Joi.array().items(Joi.string()),
        Switch: Joi.Object().keys({
          a: Joi.string().description('packetsize').optional().empty(''),
          b: Joi.string().description('On error batch abort').optional().empty(''),
          c: Joi.string().description('cmdend').optional().empty(''),
          C: Joi.string().description('Trust Server Certificate').optional().empty(''),
          d: Joi.string().description('use database name').optional().empty(''),
          D: Joi.string().description('Dsn flag, indicate -S is Dsn').optional().empty(''),
          e: Joi.string().description('echo input').optional().empty(''),
          E: Joi.string().description('trusted connection').optional().empty(''),
          h: Joi.string().description('headers').optional().empty(''),
          H: Joi.string().description('hostname').optional().empty(''),
          i: Joi.string().description('inputfile').optional().empty(''),
          I: Joi.string().description('Enable Quoted Identifiers').optional().empty(''),
          k: Joi.string().description('[1|2] remove[replace] control characters').optional().empty(''),
          K: Joi.string().description('application intent').optional().empty(''),
          l: Joi.string().description('login timeout').optional().empty(''),
          m: Joi.string().description('errorlevel').optional().empty(''),
          M: Joi.string().description('multisubnet failover').optional().empty(''),
          N: Joi.string().description('Encrypt Connection').optional().empty(''),
          o: Joi.string().description('outputfile').optional().empty(''),
          P: Joi.string().description('password').optional().empty(''),
          p: Joi.string().description('[1] print statistics[colon format]').optional().empty(''),
          q: Joi.string().description('"cmdline query"').optional().empty(''),
          Q: Joi.string().description('"cmdline query" and exit').optional().empty(''),
          r: Joi.string().description('[0|1] msgs to stderr').optional().empty(''),
          R: Joi.string().description('').optional().empty(''),
          s: Joi.string().description('').optional().empty(''),
          S: Joi.string().description('').optional().empty(''),
          t: Joi.string().description('').optional().empty(''),
          u: Joi.string().description('').optional().empty(''),
          U: Joi.string().description('').optional().empty(''),
          V: Joi.string().description('').optional().empty(''),
          w: Joi.string().description('').optional().empty(''),
          W: Joi.string().description('').optional().empty(''),
          x: Joi.string().description('').optional().empty(''),
          X: Joi.string().description('').optional().empty(''),
          y: Joi.string().description('').optional().empty(''),
          Y: Joi.string().description('').optional().empty('')
        })

  [-U login id]
  [-P password]
  [-S server or Dsn if -D is provided]
  [-H hostname]
  [-E trusted connection]
  [-N Encrypt Connection]
  [-C Trust Server Certificate]
  [-d use database name]
  [-l login timeout]
  [-t query timeout]
  [-h headers]
  [-s colseparator]
  [-w screen width]
  [-a packetsize]
  [-e echo input]
  [-I Enable Quoted Identifiers]
  [-c cmdend]
  [-q "cmdline query"]
  [-Q "cmdline query" and exit]
  [-m errorlevel]
  [-V severitylevel]
  [-W remove trailing spaces]
  [-u unicode output]
  [-r[0|1] msgs to stderr]
  [-i inputfile]
  [-o outputfile]
  [-k[1|2] remove[replace] control characters]
  [-y variable length type display width]
  [-Y fixed length type display width]
  [-p[1] print statistics[colon format]]
  [-R use client regional setting]
  [-K application intent]
  [-M multisubnet failover]
  [-b On error batch abort]
  [-D Dsn flag, indicate -S is Dsn]
  [-X[1] disable commands, startup script, environment variables [and exit]]
  [-x disable variable substitution]
[-? show syntax summary]

    }),
    docker: Joi.object()({
        containerId: Joi.string(),
        imageId: Joi.string(),
        repo: Joi.string(),
        hostPort: Joi.number(),
        sqlport: Joi.number(),
        sqlColume: Joi.string(),
    }),
    odbc: Joi.object().key({
        path: Joi.string(),
        pool:
    }),
    "path": "/opt/mssql-tools/bin",
    "pool": {
      "max": 10,
      "min": 0,
      "idleTimeoutMillis": 30000
    },
    "retry": {
      "count": 2,
      "wait": 10000
    }
    printData: Joi.boolean(),
    scriptPath: Joi.string(),
    sql: Joi.object().key({

    }),
    sqlpad: Joi.object().key({

    }),
    tailPath: Joi.string(),
    vantage: Joi.object().key({

    })
  });

````````````````````
const schema = Joi.object().keys({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().regex(/^[a-zA-Z0-9]{3,30}$/),
    access_token: [Joi.string(), Joi.number()],
    birthyear: Joi.number().integer().min(1900).max(2013),
    email: Joi.string().email()
}).with('username', 'birthyear').without('password', 'access_token');

// Return result.
const result = Joi.validate({ username: 'abc', birthyear: 1994 }, schema);
// result.error === null -> valid

// You can also pass a callback which will be called synchronously with the validation result.
Joi.validate({ username: 'abc', birthyear: 1994 }, schema, function (err, value) { });  // err === null -> valid
````````````````````````````````````
{
  "archivePath": "history",
  "cache": {
    "Batch": [],
    "BatchHistory": {},
    "Prefix": [
      "SET ARITHABORT ON;",
      "SET NOCOUNT ON;",
      "SET QUOTED_IDENTIFIER OFF;"
    ],
    "Switch": {
      "S": "172.17.0.1",
      "d": "tempdb",
      "r": "r",
      "I": "I",
      "s": "  "
    }
  },
  "docker": {
    "repo": "microsoft/mssql-server-linux",
    "hostPort": 1433,
    "sqlPort": 1433,
    "sqlVolume": "/var/opt/mssql"
  },
  "odbc": {
    "path": "/opt/mssql-tools/bin",
    "pool": {
      "max": 10,
      "min": 0,
      "idleTimeoutMillis": 30000
    },
    "retry": {
      "count": 2,
      "wait": 10000
    }
  },
  "printDate": false,
  "scriptPath": "scripts",
  "sql": {
    "acceptEULA": "Y",
    "backup": {
      "filter": ".bak",
      "path": "/var/opt/mssql/data"
    },
    "data": {
      "filter": ".mdf",
      "path": "/var/opt/mssql/data"
    },
    "dump": {
      "filter": "core",
      "path": "/var/opt/mssql/log"
    },
    "log": {
      "filter": ".ldf",
      "path": "/var/opt/mssql/data"
    },
    "conf": "/opt/mssql/lib/mssql-conf/mssql-conf.py",
    "sa": {
      "name": "sa",
      "password": "<YourStrong!Passw0rd>"
    }
  },
  "sqlpad": {
    "dir": "sqlpaddata",
    "ip": "127.0.0.1",
    "port": 8754,
    "httpsPort": 8754,
    "baseUrl": "",
    "passphrase": "yet-aN0ther_pA$$werd",
    "certPassphrase": "No cert",
    "keyPath": "",
    "certPath": "",
    "admin": "bwunder@yahoo.com",
    "debug": true,
    "googleClientId": "",
    "googleClientSecret": "",
    "disableUserpassAuth": false,
    "allowCsvDownload": true,
    "editorWordWrap": false,
    "queryResultMaxRows": 50000,
    "slackWebhook": "",
    "showSchemaCopyButton": false,
    "tableChartLinksRequireAuth": true,
    "publicUrl": "",
    "smtpFrom": "",
    "smtpHost": "",
    "smtpPort": "",
    "smtpSecure": true,
    "smtpUser": "",
    "smtpPassword": "",
    "whitelistedDomains": "" },
  "tailPath": "/usr/bin",
  "vantage": {
    "auth":{
      "middleware": "basic",
      "users": [
        { "user": "jack", "pass": "cheese"},
        { "user": "jill", "pass": "crackers"}
      ],
      "retry": 3,
      "retryTime": 500,
      "deny": 1,
      "unlockTime": 3000
    },
    "firewall": {
      "policy": "REJECT",
      "rules": [
        { "rule": "accept", "ip": "192.168.0.0", "subnet": 24 },
        { "rule": "accept", "ip": "127.0.0.1", "subnet": 32 }
      ]
    },
    "loglevel": 20,
    "port": 8753
  }
}
