# Deploying to cPanel (perks.cloudhosti.com)

Every push to `main` runs CI (typecheck, lint, auth check, unit + E2E tests, build). If it all passes, the
**deploy** job builds a standalone bundle, copies it to the server over SSH and runs
`deploy/activate.sh` there. That script:

1. installs the Prisma CLI for this release (cached),
2. runs `prisma migrate deploy`,
3. points `~/perks/current` at the new release and restarts the app,
4. waits until `/api/health` reports the new release, or **switches back** to the previous one,
5. keeps the last 5 releases.

Nothing is built on the server. Secrets live only in `~/perks/shared/.env` on the server.

```
/home/cloudho3/
  perks/
    app/app.cjs          Passenger start file (Setup Node.js App → application root "perks/app")
    current -> releases/20261112-093000-ab12cd3
    releases/…           last 5 releases
    shared/.env          production settings (chmod 600)
    shared/storage/      receipt photos (never inside public_html)
    backups/             nightly database dumps
    tools/               Prisma CLI used for migrations
  nodevenv/perks/app/24/ Node.js 24 (created by cPanel)
```

---

## One-time setup

### 1. Subdomain + SSL
cPanel → **Domains** → Create a New Domain: `perks.cloudhosti.com`. Turn off "Share document root" and keep the
suggested folder. Then **SSL/TLS Status** → select the subdomain → **Run AutoSSL**. The app needs HTTPS:
login cookies are `Secure`.

### 2. PostgreSQL
cPanel → **PostgreSQL Databases**:
- Create database `perks` (it becomes `cloudho3_perks`).
- Create user `perks` (`cloudho3_perks`). Use a long password made of **letters and digits only**, so it can go
  into a URL without escaping.
- **Add user to database** with all privileges.

Check the server version in **Terminal**: `psql --version`. Version 13 or newer is fine.

### 3. Node.js app
cPanel → **Setup Node.js App** → Create Application:

| Field | Value |
|---|---|
| Node.js version | **24.22.2** |
| Application mode | Production |
| Application root | `perks/app` |
| Application URL | `perks.cloudhosti.com` |
| Application startup file | `app.cjs` |

Click **Create**. Don't run "NPM install" and don't add environment variables here: everything is read from
`shared/.env`. The site shows an error until the first deploy. That's expected.

### 4. Production settings: `~/perks/shared/.env`
Open cPanel **Terminal**:

```bash
mkdir -p ~/perks/shared && cd ~/perks/shared
openssl rand -base64 48   # copy this: SESSION_SECRET
openssl rand -hex 24      # copy this: CRON_SECRET
nano .env                 # paste the template below, fill it in, Ctrl+O, Enter, Ctrl+X
chmod 600 .env
```

```dotenv
APP_URL=https://perks.cloudhosti.com
DATABASE_URL=postgresql://cloudho3_perks:DB_PASSWORD@localhost:5432/cloudho3_perks?schema=public
DB_POOL_MAX=5
SESSION_SECRET=paste-the-base64-value
CRON_SECRET=paste-the-hex-value

# Login codes by email (Resend). EMAIL_FROM must be on a domain verified in Resend (step 9).
OTP_CHANNELS=EMAIL
EMAIL_DRIVER=resend
RESEND_API_KEY=re_...
EMAIL_FROM="Hosting.com Perks <perks@cloudhosti.com>"
EMAIL_REPLY_TO=support@cloudhosti.com

SMS_DRIVER=off

# Receipt photos on this server, outside public_html (must be an absolute path).
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=/home/cloudho3/perks/shared/storage
```

Changing `SESSION_SECRET` later logs everyone out. After editing `.env`, restart the app (Setup Node.js App →
**Restart**).

### 5. Deploy key (GitHub → server)
On your Mac:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/perks_deploy -N "" -C "github-actions perks deploy"
cat ~/.ssh/perks_deploy.pub    # public key, goes to cPanel
```

cPanel → **SSH Access** → Manage SSH Keys → **Import Key**. Name it `perks_deploy`, paste the **public** key
into the public-key box and leave the private-key box empty. Back in the list, click **Manage** → **Authorize**.

Then find the SSH host and port. Your host's welcome email lists them; port 22 is common, some hosts use
another one. Test from your Mac:

```bash
ssh -i ~/.ssh/perks_deploy -p 22 cloudho3@SERVER_HOSTNAME 'echo connected; uname -a'
ssh-keyscan -p 22 SERVER_HOSTNAME 2>/dev/null > /tmp/perks_known_hosts   # the server's host key, for GitHub
```

If the connection times out, the host's firewall may only allow some IPs. Ask them to allow SSH for your account
(GitHub Actions runners don't have fixed IPs).

### 6. GitHub settings
Repository → **Settings → Environments** → New environment `production`. Optional: add yourself under
"Required reviewers" to approve each deploy by hand. Then add, either in that environment or in
**Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
|---|---|---|
| Secret | `CPANEL_SSH_KEY` | full contents of `~/.ssh/perks_deploy` (the **private** key) |
| Secret | `CPANEL_KNOWN_HOSTS` | contents of `/tmp/perks_known_hosts` |
| Variable | `CPANEL_HOST` | server hostname from step 5 |
| Variable | `CPANEL_USER` | `cloudho3` |
| Variable | `CPANEL_SSH_PORT` | `22` (or your host's port) |
| Variable | `APP_URL` | `https://perks.cloudhosti.com` |

With the GitHub CLI:

```bash
gh secret set CPANEL_SSH_KEY < ~/.ssh/perks_deploy
gh secret set CPANEL_KNOWN_HOSTS < /tmp/perks_known_hosts
gh variable set CPANEL_HOST --body SERVER_HOSTNAME
gh variable set CPANEL_USER --body cloudho3
gh variable set CPANEL_SSH_PORT --body 22
gh variable set APP_URL --body https://perks.cloudhosti.com
```

The deploy job is skipped while `CPANEL_HOST` is empty.

### 7. First deploy + first admin
Push to `main`, or GitHub → **Actions → CI → Run workflow** on `main`. When the deploy job is green, create the
first admin in cPanel **Terminal**:

```bash
source ~/nodevenv/perks/app/24/bin/activate
cd ~/perks/current/migrate
ADMIN_EMAIL=you@cloudhosti.com ADMIN_NAME="Your Name" node create-admin.mjs
```

It prints a one-time password. Sign in at `https://perks.cloudhosti.com/admin/login`. You must choose a new
password straight away. Add partners, branches, campaigns and other staff from the admin screens.

### 8. Cron jobs
cPanel → **Cron Jobs** → set the email for failures. Then add:

| Schedule | Command | What |
|---|---|---|
| `7 * * * *` | `/bin/bash $HOME/perks/current/deploy/cron.sh` | expire vouchers + "expires soon" emails |
| `30 21 * * *` | `/bin/bash $HOME/perks/current/deploy/backup.sh` | database dump at 03:30 Dhaka, 14 days kept |

### 9. Email domain (Resend)
Resend → **Domains** → add `cloudhosti.com` (or `mail.cloudhosti.com`). Copy the DNS records it shows into
cPanel → **Zone Editor**. When Resend shows **Verified**, put an address on that domain in `EMAIL_FROM`. Until
then, Resend only delivers to your own Resend login address.

---

## Day to day

- **Deploy:** merge or push to `main`. Watch it under GitHub → Actions. A failed check means nothing is deployed.
- **Redeploy the same code:** Actions → CI → Run workflow.
- **Roll back the code:** in Terminal, `bash ~/perks/current/deploy/rollback.sh`, then open the site once.
  Database migrations are not undone, so a migration must keep working with the previous release: add columns
  first, remove them in a later release.
- **Logs:** Setup Node.js App shows the app; errors go to `~/perks/app/stderr.log` (if your host enables it) or
  cPanel → **Errors**. Restart: Setup Node.js App → Restart, or `touch ~/perks/app/tmp/restart.txt`.
- **Visitor IPs:** `app.cjs` replaces `X-Forwarded-For` with the real connection address, so visitors can't fake
  the IP that rate limits use. Leave `CLIENT_IP_HEADER` unset. If you ever put Cloudflare or another proxy in
  front, change this first: the connection address would then be the proxy's.
- **Health:** `https://perks.cloudhosti.com/api/health` → `{"ok":true,"db":"ok","release":"…"}`. Point an
  uptime monitor at it.
- **Restore a backup:** `pg_restore --clean --if-exists --no-owner -d "postgresql://…" ~/perks/backups/<file>.dump`
  (stop traffic first). Receipts are in `~/perks/shared/storage`, covered by cPanel's own backups.
