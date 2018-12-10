The anonym can protect docker socket with a server signed certificate when config.docker.TLS is set to true 
    {
        ...
        docker: {
            ...
            TLS: true
        }
    }    
TLS credentials must be present at the time the docker daemon is started before the API web service can listen for https. A SIGHUP of dockerd can be used to reload the daemon.json, however, a Docker engine restart is needed for others e.g., host, port and protocol all seem cleaner with a daemon restart. The recommendation here is to get TLS running the way you want early and resist unnecessary changes, then reboot the docker daemon when changes are made. 

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

