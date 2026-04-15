# RoomBook VPS Deployment Guide

## Prerequisites
- SSH into: `ssh root@154.66.198.174`
- Domain `roombook.co.za` DNS A record pointing to `154.66.198.174`

---

## Step 1: Create deploy user (don't run as root)

```bash
adduser --disabled-password --gecos "" roombook
usermod -aG sudo roombook
```

## Step 2: Install Node.js 20 + PM2 + Caddy

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# PM2 (process manager)
npm install -g pm2

# Caddy (reverse proxy + auto SSL)
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

# Git
apt-get install -y git
```

## Step 3: Clone the repo

```bash
mkdir -p /var/www
cd /var/www
git clone <YOUR_GITHUB_REPO_URL> roombook
cd roombook
```

If not on GitHub yet, you can SCP the files:
```bash
# From your Windows machine:
scp -r "C:\AI Apps\RoomBook" root@154.66.198.174:/var/www/roombook
```

## Step 4: Install dependencies and build

```bash
cd /var/www/roombook
npm install
```

## Step 5: Create .env.local on the server

```bash
cat > /var/www/roombook/.env.local << 'EOF'
# Convex (use your production deployment)
CONVEX_DEPLOYMENT=<your-convex-cloud-deployment>
NEXT_PUBLIC_CONVEX_URL=<your-convex-cloud-url>

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c2VsZWN0LXRvcnRvaXNlLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_Bs7QXOKsvPS1CEUtJ8q7WEEJBsMVzlUrz3opQdyGAl
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Resend (add later)
RESEND_API_KEY=
EOF
```

**IMPORTANT:** Update the Convex deployment URL to your cloud deployment, not localhost!

## Step 6: Deploy Convex to cloud (if not already)

```bash
cd /var/www/roombook
npx convex deploy
```

## Step 7: Build the app

```bash
cd /var/www/roombook
npm run build
```

## Step 8: Start with PM2

```bash
cd /var/www/roombook
PORT=3200 pm2 start npm --name "roombook" -- start
pm2 save
pm2 startup
```

## Step 9: Configure Caddy

**IMPORTANT:** Check if Caddy is already running with a Caddyfile for other apps:
```bash
cat /etc/caddy/Caddyfile
```

If other sites exist, **ADD** to the existing Caddyfile (don't replace it):

```bash
cat >> /etc/caddy/Caddyfile << 'EOF'

roombook.co.za, www.roombook.co.za {
    reverse_proxy localhost:3200
}
EOF
```

Then reload Caddy:
```bash
caddy reload --config /etc/caddy/Caddyfile
# OR if using systemd:
systemctl reload caddy
```

Caddy will automatically get an SSL certificate from Let's Encrypt.

## Step 10: Update Clerk redirect URLs

In Clerk Dashboard → Configure → Developers → Paths:
- Set fallback development host to: `https://roombook.co.za`

In Account Portal → Redirects:
- After sign-in fallback: `/dashboard`
- After sign-up fallback: `/onboarding`

## Step 11: Verify

Visit https://roombook.co.za — you should see the landing page with SSL.

---

## Updating the app later

```bash
cd /var/www/roombook
git pull
npm install
npm run build
pm2 restart roombook
```

## Checking logs

```bash
pm2 logs roombook
```

## Checking status

```bash
pm2 status
caddy validate --config /etc/caddy/Caddyfile
```
