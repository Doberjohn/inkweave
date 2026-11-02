# CI on the owner's PC

While the repo is private, every minute a job spends on GitHub's runners counts against the account's 2,000 free minutes a month, which inkweave-admin shares, and the app's CI used about 38,500 in October. So the app's jobs run on self-hosted runners on the owner's Windows 11 PC instead, where minutes cost nothing (#1086).

## How jobs find the PC

- **One switch.** The repository variable `CI_ON_PC` (Settings → Secrets and variables → Actions → Variables). Set to `true`, jobs go to runners labelled `inkweave-linux` (Ubuntu in WSL2) and `inkweave-windows` (Windows itself). Unset, they go to GitHub's `ubuntu-latest` and `windows-latest`, as before.
- **Who can run code on the PC.** Anyone whose push or pull request starts a workflow. While the repo is private, that is you, the people you give access to, and Dependabot: only people with access can fork a private repo. Keep Settings → Actions → General → Fork pull request workflows → "Run workflows from fork pull requests" off. The routing rule sends a pull request from any other repository to GitHub's runners, but that is no barrier on its own: a fork's pull request runs the workflow files on its own branch, which can name the PC's label directly. So **keep the repo private while the runners are registered**, and take them off before it goes public (Day to day, below).
- **Dependabot proposes versions a week old.** `.github/dependabot.yml` sets a 7-day `cooldown` (GitHub's default is 3), so a newly published version reaches a pull request, and the PC, only after it has been out a week, by when most bad releases have been pulled. Security updates don't wait.
- **Two workflows stay on GitHub:** Claude review, which installs a sandbox with `sudo` and changes a kernel setting, and the drift alarm, which has to run while the PC is off. `scripts/ci-runners.test.mjs` fails a job that runs anywhere else.
- **While the PC is off, jobs wait.** GitHub holds a job for a self-hosted runner up to 24 hours, then fails it; re-run it once the PC is back. Deploy waits too, so a merge reaches inkweave.ink only when the PC is on, and the drift alarm opens its issue after 3 hours.
- **Which browsers run when** (to keep the PC's load down): chromium and mobile-chrome on every push, to a pull request or to master (`ci.yml`); firefox, webkit and mobile-safari once when a pull request opens ready for review, again whenever the `full-e2e` label is added (remove it and add it again if it's already there), never on a draft, and all five nightly on master and on Run workflow (`full-e2e.yml`).

## What the PC needs

- Hardware virtualization on (WSL2 needs it), and the PC set never to sleep while plugged in.
- Memory and cores: each runner takes one job at a time, and an E2E or Deploy job wants about 4 to 6 GB and 2 to 4 cores. Start with 2 Linux runners on a PC with 16 GB to spare, 3 on 32 GB or more.
- About 40 GB of disk: a workspace with `node_modules` per runner, and about 2 GB of Docker image per Playwright version.

## 1. A WSL distro for the runners

In Windows PowerShell, as administrator. The runners get a distro of their own, so they never see your other WSL work:

```powershell
wsl --update
wsl --install Ubuntu-24.04 --name inkweave-ci
```

It asks for a username and password: that is the distro's admin account, not the runners'. Then cap what WSL may take from the desktop, in `%UserProfile%\.wslconfig` (applies to every distro; size it to your PC):

```ini
[wsl2]
memory=16GB
processors=8
```

Open the distro as root (`wsl -d inkweave-ci -u root`) and write `/etc/wsl.conf`:

```ini
[boot]
systemd=true

[automount]
enabled=false

[interop]
enabled=false
appendWindowsPath=false
```

systemd runs Docker and the runner services. With no automount a job can't read your C: or D: drive, and with no interop it can't start a Windows program. Restart the distro to apply it: `wsl --terminate inkweave-ci` in PowerShell, then `wsl -d inkweave-ci -u root` again.

## 2. Docker, the tools and the runner user

As root in the distro:

```bash
apt-get update
apt-get install -y docker.io git curl jq zstd unzip ca-certificates cron
curl -fsSL -o /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
chmod +x /usr/local/bin/yq
systemctl enable --now docker

getent passwd 1001 || useradd -m -u 1001 -s /bin/bash gha
usermod -aG docker gha
```

The runner user must have uid 1001: the Playwright container jobs run as `--user 1001` and write to the workspace the runner owns. If `getent` prints a user, that uid is taken; free it before going on.

**Check:** `sudo -iu gha docker run --rm hello-world` prints "Hello from Docker!", and `yq --version` prints v4.

## 3. The Linux runners

On GitHub, open Settings → Actions → Runners → New self-hosted runner → Linux, x64. Keep the page open: it shows the download URL and a registration token, valid for an hour, which registers every runner below.

As `gha` (`sudo -iu gha`), once per runner, with `N` = 1, 2, 3:

```bash
mkdir ~/runner-N && cd ~/runner-N
curl -o actions-runner.tar.gz -L <the download URL the page shows>
tar xzf actions-runner.tar.gz
./config.sh --url https://github.com/Doberjohn/inkweave --token <the token> \
  --name pc-linux-N --labels inkweave-linux --unattended
printf 'XDG_DATA_HOME=%s\nXDG_CACHE_HOME=%s\n' "$HOME/runner-N/_data" "$HOME/runner-N/_cache" >> .env
```

The last line gives each runner its own pnpm store and caches (the runner reads `.env` from its folder). The runners all run as `gha`, and two jobs restoring the pnpm store into one shared folder at once could trip over each other.

Then as root, once per runner, to run it as a service that starts with the distro:

```bash
cd /home/gha/runner-N && ./svc.sh install gha && ./svc.sh start
```

Clear out old Playwright images weekly, as `gha`:

```bash
(crontab -l 2>/dev/null; echo '0 12 * * 0 docker image prune -af --filter until=336h') | crontab -
```

**Check:** Settings → Actions → Runners lists `pc-linux-1` and the rest as Idle.

## 4. Keep the distro running

WSL stops a distro when nothing holds it open, which would take the runners down with it. In Windows PowerShell (not as administrator), add a task that holds it open from logon:

```powershell
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-WindowStyle Hidden -Command "wsl.exe -d inkweave-ci -u gha --exec sleep infinity"'
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'Inkweave CI runners' -Action $action -Trigger $trigger -Settings $settings
Start-ScheduledTask -TaskName 'Inkweave CI runners'
```

**Check:** `wsl --list --running` lists `inkweave-ci` a few minutes after you close every WSL window.

## 5. The Windows runner

The Windows script tests run on Windows itself. On GitHub, New self-hosted runner → Windows, x64, then in Windows PowerShell as administrator:

```powershell
mkdir C:\gha-win; cd C:\gha-win
Invoke-WebRequest -Uri '<the download URL the page shows>' -OutFile actions-runner.zip
Expand-Archive actions-runner.zip -DestinationPath .
.\config.cmd --url https://github.com/Doberjohn/inkweave --token '<the token>' --name pc-windows --labels inkweave-windows --runasservice --unattended
git config --system core.longpaths true
```

It runs as a Windows service, so it starts with Windows and needs no logon. It uses Git for Windows from the PATH and Windows PowerShell 5.1, which the workflow names (`shell: powershell`).

**Check:** `pc-windows` shows as Idle beside the Linux runners.

## 6. Turn it on

Settings → Secrets and variables → Actions → Variables → New repository variable: `CI_ON_PC`, value `true`. Re-run any workflow.

**Check:** each job's log starts with "Runner name: pc-linux-1" (or another `pc-` name).

## Day to day

- **The PC was off:** queued jobs start when it's back. Re-run any that failed after 24 hours, and Deploy's newest run if a merge never reached inkweave.ink.
- **Something is wrong with the PC:** delete `CI_ON_PC`. Every job goes back to GitHub's runners at once, paid while the repo is private.
- **The repo goes public:** take the runners off it first. Deleting `CI_ON_PC` alone isn't enough: anyone can then open a pull request, and a fork's pull request can name the PC's label in its own copy of a workflow. Remove every runner (Removing them, below; keep the distro and the scheduled task if you'll be back), then delete `CI_ON_PC`. Public repos run on GitHub's runners for free. When it's private again, cancel any run still queued (Actions, filter `is:queued`), then register the runners again (steps 3 and 5) and set `CI_ON_PC`.
- **Secrets, and what stays behind:** Deploy's and Deploy Staging's secrets (the Vercel token among them) reach the PC's runners during those jobs. GitHub's runners start clean for every job; the PC's keep their files between jobs (each runner's folder, the pnpm store, Docker images, `gha`'s home), so code that ran in one job could leave something behind for a later one. That is why only your own code and week-old bumps run there, and why a job keeps its temporary files in `$RUNNER_TEMP`, which the runner empties for each job, never `/tmp`, which the runners share.
- The runners update themselves.

## Removing them

On GitHub, Settings → Actions → Runners → a runner → Remove shows a removal token. Then, as root in the distro, for each Linux runner:

```bash
cd /home/gha/runner-N && ./svc.sh stop && ./svc.sh uninstall
sudo -u gha ./config.sh remove --token <the removal token>
```

In Windows PowerShell as administrator: `cd C:\gha-win; .\config.cmd remove --token '<the removal token>'`. Then `Unregister-ScheduledTask -TaskName 'Inkweave CI runners'` and, to drop the distro and everything in it, `wsl --unregister inkweave-ci`.
