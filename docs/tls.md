#TLS Port Cloaking

Privacy and authenticity of the anonym are enhanced with Transport Layer Security (TLS) for Interprocess Communications (IPC) embargos. That is to say, prevent the external network from carrying anything any more informative to snoops than a bit streams encrypted with short-lived credentials. The embargos provide privacy, data integrity and, potentially, client authentication forward secrecy. 

SQLPad exposes a basic user login functionalty apart from the OS or SQL Server and does not use TLS clientAuth credentials so is best suited for a backdoor configuration that accepts https requests from the outside. Google oAuth can also be configured for SQLPad. If the sqlpad.json IP address is set to use a valid network address other than 'localhost', the setting if you have not changed it yet, then you, perhaps Data Analysts and testers can be set up for read-only access to anonym data and oAuth can be enabled.    

Automation of TLS with forward secrecy (new cert for each session) and hotel juliet (remove all keys in keystore then generate a new CA). Automation targets the Docker API at the daemon with or withour client authentication, the SQLPad Express web server and the SQL Server query engine connection. 

Use service-stop then service-start to cycle the dockerd daemon whenever changes are made. A SIGHUP or service-restart does not fully & reliably refresh config used to open active sockets. It works occassionally but as often will miss something. The anonym is trained to identify and replace missing or mis-signed credentials as it initializes it's own configuration at npm-start. 

Hotel Juliet (hj) - or total rekey leaving only a new CA - command ought to be undertaken regularly. The hj will generate a new self-signed CA, thereby invalidating all TLS certificates currently in use so it takes the liberty to delete those too. The hj is your friend if anything happens to corrupt the TLS or you suspect someone uninvited is listening to your data stream. By testing the hj routinely the process will be familiar. Minor issues that tend to arise as systems change can be more easily mitigated. Without the testing, a total rekey will feel much more threatening than it is in part due to the unfamiliarity. 

## Docker

The anonym will cloak the dockerd socket using TLS with server's self-signed 'CA' whenever config.docker.TLS is set to true.  
    {
        ...
        docker: {
            ...
            TLS: true
        }
    }    
TLS credentials must be present at the time the docker daemon is started before the API web service can listen for https. 

To enable TLS (https) at the Docker server, include a daemon.json in the /etc/docker folder with exactly one JSON object in the file with at least the following unique keys: 

    {
        "tls": true,
        "tlscacert": "/home/bwunder/anonym/private/CA-cert.pem",
        "tlscert": "/home/bwunder/anonym/private/docker-cert.pem",
        "tlskey": "/home/bwunder/anonym/private/docker-key.pem"
    }

Note: Do not set options in daemon.json that have already been set on daemon startup command line args. 

see https://docs.docker.com/engine/security/https/ 

To use client authentication, also include
        "tlsverify": true, 
and generate cientAuth credentials signed by the same Certificate as the server's key.
    From the CLI: 
        certificate docker --clientAuth

File names for credentials not created by the anonym must follow the file naming convention expected
by the anonym - alternately, the local connectAPI function in the api.js module must be modified:
    for example, on my host, the CLI generates:
        "/home/bwunder/anonym/private/dockerCLI-cert.pem"
        "/home/bwunder/anonym/private/dockerCLI-key.pem"

The rest of page is copy-paste from the Docker online documentation. I think the values 
shown are the daemon defaults at the current time anyway.

https://docs.docker.com/engine/reference/commandline/dockerd/#daemon-configuration-file (Nov 6, 2018)


The default location of the configuration file on Linux is /etc/docker/daemon.json. 
The --config-file flag can be used to specify a non-default location.

This is a full example of the allowed configuration options on Linux:

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

## SQLPad

