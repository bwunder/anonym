# TLS  

Both privacy and authenticity of the anonym will be hardened with a Transport Layer Security (TLS) to embargo broadcast Interprocess Communications (IPC). That is to say, to prevent the external network from seeing anything any more informative to snoops than a bit stream scrambled with high quality and short-lived credentials. The embargo affords an improved privacy and data integrity interval and also enables the TLS client authentication option. 

Automation of TLS with forward secrecy (e.g., new certs each app session) and hotel juliet after each push to remote.   

Always cycle the socket process after credential changes. A SIGHUP or service-restart may not fully & reliably refresh config used by open active sockets. It usually works, but can leave some things in the old state. The app is trained to verify and repair the TLS encryption hierarchy and socket configurations as it initializes it's own configuration, but that only happens at npm-start.    

Hotel Juliet or overwrite all keys in the private communications keystore, including the "CA", is a modern version of a complete rekey not unlike what the Cold War cryptographers of the 20th century termed, "Hotel Juliet", "hj" or, coloquially as "going high and blind." Hotel Juliet rekeys ought to be undertaken regularly. The hj will generate a new self-signed CA, thereby invalidating all TLS certificates currently in use so it takes the liberty to delete those too. The hj is your friend if anything happens to corrupt the TLS or you suspect someone uninvited is listening to your data stream. By testing the hj routinely the process will be familiar. Minor issues that tend to arise as systems change can be more easily mitigated. Without testing, a total rekey will feel ever more threatening than it really is, in part due to the unfamiliarity, in part due to the trepidations induced by avoidance. 

Use the __certificate__ CLI command to review the certificates on hand, to generate new certificates or to replace the credentials currently in use.  

## CA

The app's private TLS encryption hierarchy is rooted by an app generated Certificate self-signed by the host. We will refer to this as the "CA" or Certificate Authority, even though it is not signed by a Public Authority. This is absolutely NOT a secure way to use TLS when serving data to the network. Self signing is highly vulnerable to man-in-the-middle styled penetration. Because our need is to embargo our data bits from the network, not to broadcast them securely, and our requirements include the ability to get all your work - other than source control push/pull to remote - done whether or not the host is connected to a network. In this usage, the self-signed root is the most appropriate root vector for app authentication. For increased security of our shroud, we will replace the complete hierarchy frequently and renew our socket creds at each app start. 

The CA is generated when it is needed to sign a credential and not found. No explicit use action is required.

## Docker

At the next app start after __config.docker.TLS__ is set to true, the anonym will cloak the dockerd socket's API requests/responses under TLS using credentials signed by the host's self-signed 'CA' and assure that the correct configuration and credentials are in place at 'npm start'. This will instrument the Docker daemon with TLS server authentication.   

The TLS credentials appropriate to the configuration must be present at daemon start in order for the Docker API to listen using TLS.
Docker docs warn, "Do not set options in daemon.json that have already been set as daemon startup command line args." 

Review the daemons command line args with something like:
    > ps -eo command|grep dockerd
    /~clip~/usr/bin/dockerd __-H fd:// --containerd=/run/containerd/containerd.sock__ 
    -or-
    > sudo systemctl status docker
    bill@HOST:~/anonym$ sudo systemctl status docker
    ● docker.service - Docker Application Container Engine
      Loaded: loaded (/lib/systemd/system/docker.service; enabled; vendor preset: enabled)
      Active: active (running) since Sat 2020-02-15 07:25:40 MST; 5h 21min ago
        Docs: https://docs.docker.com
    Main PID: 1622 (dockerd)
        Tasks: 29
      CGroup: /system.slice/docker.service
              ├─1622 /usr/bin/dockerd __-H fd:// --containerd=/run/containerd/containerd.sock__
              ├─6161 /usr/bin/docker-proxy -proto tcp -host-ip 0.0.0.0 -host-port 46769 -container-ip 172.17.0.3 -container-port 1433
              └─8532 /usr/bin/docker-proxy -proto tcp -host-ip 0.0.0.0 -host-port 43527 -container-ip 172.17.0.2 -container-port 1433


To enable TLS (https) on the Docker Container Instance Engine daemon, a daemon.json object file is placed in the /etc/docker folder with, minimally, the following unique keys: 

    { 
        "tls": true,
        "tlscacert": "/~clip~/anonym/private/CA-cert.pem",
        "tlscert": "/~clip~/anonym/private/docker-cert.pem",
        "tlskey": "/~clip~/anonym/private/docker-key.pem"
    }

When __config.docker.api.tlsverify__ is set to true, Docker client authentication is enabled at the next CLI start.
Docker client authentication implies server authentiction and uses cientAuth credentials signed by the same Certificate as the server's key.
    From the CLI: 
        certificate docker --clientAuth

File names for credentials not created by the anonym must follow the file naming convention expected
by the anonym - alternately, the local connectAPI function in the api.js module must be modified:
    for example, on my host, the CLI generates:
        "/~clip~/anonym/private/dockerCLI-cert.pem"
        "/~clip~/anonym/private/dockerCLI-key.pem"

[The rest of this section is a copy-paste snapshot from the Docker online documentation. See the current Docker documentation.]

The default location of the dockerd configuration file on Linux is /etc/docker/daemon.json. 
The --config-file flag on the daemon startup command line can be used to specify a non-default config location.

This is an example of the allowed daemon.json options. I believe the values shown are the daemon defaults at the time of the snapshot. (11-6-2018): https://docs.docker.com/engine/reference/commandline/dockerd/#daemon-configuration-file 

    {
        "authorization-plugins": [],
        "data-root": "",
        "dns": [],
        "dns-opts": [],
        "dns-search": [],
        "exec-opts": [],
        "exec-root": "",
        "experimental": false,
        "storage-driver": "",
        "storage-opts": [],
        "labels": [],
        "live-restore": true,
        "log-driver": "",
        "log-opts": {},
        "mtu": 0,
        "pidfile": "",
        "cluster-store": "",
        "cluster-store-opts": {},
        "cluster-advertise": "",
        "max-concurrent-downloads": 3,
        "max-concurrent-uploads": 5,
        "default-shm-size": "64M",
        "shutdown-timeout": 15,
        "debug": true,
        "hosts": [],
        "log-level": "",
        "tls": true,
        "tlsverify": true,
        "tlscacert": "",
        "tlscert": "",
        "tlskey": "",
        "swarm-default-advertise-addr": "",
        "api-cors-header": "",
        "selinux-enabled": false,
        "userns-remap": "",
        "group": "",
        "cgroup-parent": "",
        "default-ulimits": {},
        "init": false,
        "init-path": "/usr/libexec/docker-init",
        "ipv6": false,
        "iptables": false,
        "ip-forward": false,
        "ip-masq": false,
        "userland-proxy": false,
        "userland-proxy-path": "/usr/libexec/docker-proxy",
        "ip": "0.0.0.0",
        "bridge": "",
        "bip": "",
        "fixed-cidr": "",
        "fixed-cidr-v6": "",
        "default-gateway": "",
        "default-gateway-v6": "",
        "icc": false,
        "raw-logs": false,
        "allow-nondistributable-artifacts": [],
        "registry-mirrors": [],
        "seccomp-profile": "",
        "insecure-registries": [],
        "no-new-privileges": false,
        "default-runtime": "runc",
        "oom-score-adjust": -500,
        "node-generic-resources": ["NVIDIA-GPU=UUID1", "NVIDIA-GPU=UUID2"],
        "runtimes": {
            "cc-runtime": {
                "path": "/usr/bin/cc-runtime"
            },
            "custom": {
                "path": "/usr/local/bin/my-runc-replacement",
                "runtimeArgs": [
                    "--debug"
                    ]
            }
        }
    }
The command-line options, a quite similar listing, can be viewed at
  > dockerd --help
-or-
https://docs.docker.com/engine/reference/commandline/dockerd/  
see also (https://docs.docker.com/engine/security/https/) 

## SQLPad

When a connection to the anonym is needed from the outside world, a connection to the private __SQLPad__ is preferred where possible. The anonym's SQLPad is configured to run as a dependent child process and uses a private query store.

__SQLPad__ exposes basic authentication with secrets encrypted into it's nedb store in combination with TLS server authentication. Google authentication can also be configured for __SQLPad__'s oauth, and __SQLPad__ is tooled for SMTP for the old school network monkeys as well as Slack. If the sqlpad.json IP address is set to use a valid network address other than 'localhost' or perhaps the host's VNET gateway IP. In any case, SQLPad is a fine remote query tool. However, in keeping to the anonym theme, the CLI intentionally employs no remote dependencies into the query chain (e.g., no oauth, Slack, SMPT, Azure, etc.).  

Nonetheless, it might be advantageous if other team members could jump on your anonym from time to time. __SQLPad__ would be the most straight-forward socket to use for that purpose. Unfortunately, __SQLPad__ does not use TLS client authentication. For that reason alone, __SQLPad__ remote access should only be enabed when needed and at least the basic passwords should always be used in addition to TLS.

__SQLPad__ can be configured in a _.json_ or _.ini_ file or in environment variables. __anonym__ uses use container environment variables. In the anonym the config implementation details for SQLPad and SQL Server containers are quite similar. Efforts to remove or decouple external resources from the run time environment is kept always at the fore.  

See the SQLPad github repo for current configuration requirements when configuring for remote access. The SQLPad configuration has evolved considerable over 2019 and 2020 - with a couple of breaking changes in the mix. Some caution is advised. 

SQLPad source https://github.com/rickbergfalk/sqlpad

## SQL Server

SQL Server has supported TLS of connections to the query engine for years. 
