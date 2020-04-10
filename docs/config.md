The `./config/config.json` file contains defaults in 11 categories. Here actual key values are replaced with a brief description of the value and use of that value by the the CLI. Refer to the './config/config.json' for value

{
  "browser": { 
    "command": "The browser executable and any switches needed. HTML file paths will be passed to this command.",
    "style": "the highlight.js style sheet to use. Used when rendering source code files for the browser"
  },  
  "ca": {  Server-signed Certificate Authority  
    "name": "Name to prefix to '-key.pem' and '-cert.pem' when naming private key and certificate .pem files.",
    "password": "Default CA password, user is prompted for another whenever a new CA is created.",
    "csr": { 
      "keyBitsize": 2048, 
      "hash": "SHA256",
      "country": "US",
      "state": "CO",
      "locality": "Paypal"
    }  
  },
  "cli": {
    "bash": {
      "path": "bash"
    },
    "canElevate": true,
    "checkSyntax": true,
    "docs": {
      "path": "docs"
    },
    "log": {
      "debug": true,
      "inspect": {
        "colors": true,
        "depth": 3
      }
    },
    "ucons": {
      "catalog": {"style": "bold.cyan", "codepoint": "0x1F5A7"},
      "confirm": {"style": "bold.green", "codepoint":"0x1F5F8"},    
      "containerIdle": {"style": "bold.red", "codepoint":"0x25CF"},    
      "containerRunning": {"style": "bold.green", "codepoint":"0x25CF"},    
      "debug": {"style": "bold.greenBright", "codepoint": "0x2370"},
      "error": {"style": "bold.red", "codepoint": "0x274E"},
      "exit": {"style": "bold.redBright", "codepoint": "0x2BA8"},
      "info": {"style": "bold", "codepoint": "0x2757"},
      "image": {"style": "bold.blueBright", "codepoint": "0x25CF"},
      "log": {"style": "", "codepoint": ""},
      "progress": {"style": "", "codepoint": ""},
      "remark": {"style": "blue", "codepoint":"0x2505"},   
      "sqldb": {"style": "bold.orange", "codepoint": "0x16DE"},
      "sqlpad": {"style": "bold", "codepoint":"0x1F4C9"},
      "sudo": {"style": "bold.yellowBright", "codepoint": "0x1F934"},
      "tab": {"style": "bold.inverse", "codepoint": "0x1F892"},
      "target": {"style": "bold", "codepoint": "0x1F9FF"},
      "test": {"style": "rgb(153,255,51)", "codepoint": "0x1F50E"},
      "warn": {"style": "bold.yellowBright", "codepoint": "0x2BC5"}
    },
    "numberStreamedLines": true, 
    "odbc": {
      "path": "/opt/mssql-tools/bin"
    },
    "scripts": {
      "path": "scripts",
      "filter": ".sql"
    }
  },
  "docker": {
    "api": {
      "tlsverify": false,
      "name": "dockerCLI",
      "usage": "clientAuth",
      "password": "mibonbonantimonyglockenspiel"
    },
    "bindings": {
      "backups": {
        "filter": ".bak",
        "mount": {
          "Type": "bind",
          "Propagation": "shared"
        }
      },
      "private": {
        "filter": ".pem",
        "mount": {
          "Type": "bind",
          "Mode": "ro", 
          "ReadOnly": true,
          "Propagation": "shared"
        }
      },  
      "staging": {
        "mount": {
          "Type": "bind",
          "Propagation": "shared"
        }
      }
    },
    "tail": {
      "settings": { 
        "follow": true, 
        "stdout": true, 
        "stderr": true, 
        "timestamps": false, 
        "tail": "all"
      },
      "timeout": 30000
    },
    "daemon" : {
      "name": "docker",
      "usage": "docker-key.pem",
      "cfgPath": "/etc/docker/daemon.json",
      "socketPath": "/var/run/docker.sock",
      "password": "W!sh!h@dArANd0mSecretGener@tor...MAB?l^1I-checkIN2tHaT",
      "tls": true
    }
  },
  "editor": "emacs",
  "git": {
    "user": "bwunder",
    "email": "bwunder@yahoo.com",
    "origin": "https://github.com/bwunder/anonym.git"
  },
  "ide": "code",
  "mssql": {
    "conf": "/opt/mssql/lib/mssql-conf/mssql-conf.py",
    "env": {
      "ACCEPT_EULA": "Y",
      "MSSQL_MEMORY_LIMIT_MB": "",
      "MSSQL_LCID": "1033",
      "MSSQL_COLLATION": "",
      "MSSQL_TCP_PORT":" 1433",
      "MSSQL_IP_ADDRESS": "",
      "MSSQL_ENABLE_HADR": "0",
      "MSSQL_AGENT_ENABLED": "false",
      "MSSQL_MASTER_DATA_FILE": "",
      "MSSQL_MASTER_LOG_FILE": "",
      "MSSQL_SA_PASSWORD": "YourStrong!Passw0rd",
      "MSSQL_PID": "Developer",
      "MSSQL_BACKUP_DIR": "/var/opt/anonym/backup",
      "MSSQL_BIN_DIR": "/opt/mssql/bin",
      "MSSQL_DATA_DIR": "/var/opt/mssql/data",
      "MSSQL_ERRORLOG_DIR": "/var/opt/mssql/log",
      "MSSQL_LOG_DIR": "/var/opt/mssql/data",
      "MSSQL_DUMP_DIR": "/var/opt/mssql/log",
      "PRIVATE_DIR": "/var/opt/anonym/private",
      "STAGING_DIR": "/var/opt/anonym/staging"
    },
    "path": "/var/opt/mssql",
    "pkey": { 
      "passphrase": "zist.d;m$$q1-pke_pazfrace"
    },  
    "pool":  {
      "connectionTimeout": 15000,
      "options": {
        "encrypt": false,
        "enableArithAbort": true
      },
      "parseJSON": true,
      "pool": {
        "closeTimeoutMillis": 30000,
        "idleTimeoutMillis": 30000,
        "max": 10,
        "min": 0
      },
      "requestTimeout": 15000,
      "server": "localhost",
      "stream": false,
      "user": "sa",
      "database": "master"
    },
    "repo": {
      "name": "Microsoft SQL Server on Linux",
      "path": "mcr.microsoft.com/mssql/server",
      "tag": "latest",
      "availableTags": "https://mcr.microsoft.com/v2/mssql/server/tags/list"
    },  
    "sql": {
      "name": "SQL Server on Linux",
      "repo": "mcr.microsoft.com/mssql/server",
      "tag": "latest"
    }
  },
  "sqlpad": {
    "bindings": {
      "sqlpaddata": {
        "filter": ".db",
        "mount": {
          "Type": "bind",
          "Mode": "rw", 
          "Propagation": "shared"
        }
      },
      "private": {
        "filter": ".pem",
        "mount": {
          "Type": "bind",
          "Mode": "ro", 
          "ReadOnly": true,
          "Propagation": "shared"
        }
      }
    },  
    "env": {
      "SQLPAD_ADMIN": "bwunder@yahoo.com",
      "SQLPAD_ADMIN_PASSWORD": "SQLPad-admin_p@ssword",
      "SQLPAD_ALLOW_CSV_DOWNLOAD": true,
      "SQLPAD_BASE_URL": "/sqlpad",
      "CERT_PASSPHRASE": "SQLPad_cert-PASSWerd",
      "CERT_PATH": "/var/opt/private",
      "SQLPAD_COOKIE_NAME": "omit-key-to-use-default-sqlpad.sid for cookie name",
      "SQLPAD_COOKIE_SECRET": "secret-used-to-sign-cookies-please-set-and-make-strong",
      "SQLPAD_DB_PATH": "/var/opt/sqlpaddata",
      "SQLPAD_DEBUG": false,
      "DISABLE_USERPASS_AUTH": false,
      "SQLPAD_EDITOR_WORD_WRAP": false,
      "GOOGLE_CLIENT_ID": "",
      "GOOGLE_CLIENT_SECRET": "",
      "SQLPAD_HTTPS_PORT": 8754,
      "SQLPAD_IP": "provide vnet ip for best privacy or 0.0.0.0 for all-comers",
      "KEY_PATH": "absolute path, set in code if .tls is true",
      "SQLPAD_PASSPHRASE": "A string used to encrypt secrets when stored on disk",
      "SQLPAD_PORT": 8753,
      "PUBLIC_URL": "",
      "SQLPAD_QUERY_RESULT_MAX_ROWS": 50000,
      "SAML_AUTH_CONTEXT": "",
      "SAML_CALLBACK_URL": "",
      "SAML_CERT": "",
      "SAML_ENTRY_POINT": "",
      "SAML_ISSUER": "",
      "SQLPAD_SESSION_MINUTES": 60,
      "SQLPAD_SLACK_WEBHOOK": "",
      "SQLPAD_SMTP_FROM": "",
      "SQLPAD_SMTP_HOST": "",
      "SQLPAD_SMTP_PASSWORD": "",
      "SQLPAD_SMTP_PORT": "",
      "SQLPAD_SMTP_SECURE": true,
      "SQLPAD_SMTP_USER": "",
      "SQLPAD_SYSTEMD_SOCKET": "",
      "SQLPAD_TABLE_CHART_LINKS_REQUIRE_AUTH": true,
      "SQLPAD_TIMEOUT_SECONDS": 300,
      "WHITELISTED_DOMAINS": "",
      "SQLPAD_QUERY_HISTORY_RETENTION_PERIOD_IN_DAYS": 30,
      "SQLPAD_QUERY_HISTORY_RESULT_MAX_ROWS": 1000
    },
    "repo": {
      "path": "sqlpad/sqlpad",
      "tag": "latest"
    },     
    "runAtStartup": false,
    "tls": true
  },  
  "sqlcmd": {
    "prebatch": [
      "SET STATISTICS PROFILE ON;"
    ],
    "prefix": [
      "SET ANSI_DEFAULTS ON;"
    ],
    "switch": {
      "U": "sa",
      "P": "$MSSQL_SA_PASSWORD",
      "r": "r"
    }
  },
  "store": {
    "path" : "data"
  }

}
