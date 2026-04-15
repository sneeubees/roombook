import paramiko
import sys
import time

sys.stdout.reconfigure(encoding='utf-8')

def run_ssh(ssh, cmd, timeout=120):
    print(f"\n>>> {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out.strip():
        print(out)
    if err.strip():
        print(f"STDERR: {err}")
    return out, err

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('154.66.198.174', username='root', password='jCG#9KRi0cUQ', timeout=15)
print("Connected to VPS")

# Step 1: Clone repo
run_ssh(ssh, 'cd /var/www && rm -rf roombook && git clone https://github.com/sneeubees/roombook.git', timeout=120)

# Step 2: Install dependencies
run_ssh(ssh, 'cd /var/www/roombook && npm install --production=false 2>&1 | tail -5', timeout=300)

# Step 3: Create .env.local
env_content = """# Convex
CONVEX_DEPLOYMENT=dev:fearless-salmon-983
NEXT_PUBLIC_CONVEX_URL=https://fearless-salmon-983.eu-west-1.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://fearless-salmon-983.eu-west-1.convex.site

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_c2VsZWN0LXRvcnRvaXNlLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_Bs7QXOKsvPS1CEUtJ8q7WEEJBsMVzlUrz3opQdyGAl
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Resend
RESEND_API_KEY=
"""
# Write env file
sftp = ssh.open_sftp()
with sftp.open('/var/www/roombook/.env.local', 'w') as f:
    f.write(env_content)
sftp.close()
print("Created .env.local")

# Step 4: Build
print("\nBuilding Next.js (this takes a few minutes)...")
run_ssh(ssh, 'cd /var/www/roombook && npm run build 2>&1 | tail -30', timeout=600)

# Step 5: Start with PM2
run_ssh(ssh, 'pm2 delete roombook 2>/dev/null; cd /var/www/roombook && PORT=3200 pm2 start npm --name "roombook" -- start')
run_ssh(ssh, 'pm2 save')

# Step 6: Create Nginx config
nginx_config = """server {
    server_name roombook.co.za www.roombook.co.za;

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 25m;

    listen 80;
    listen [::]:80;
}
"""
sftp = ssh.open_sftp()
with sftp.open('/etc/nginx/sites-available/roombook.co.za', 'w') as f:
    f.write(nginx_config)
sftp.close()
print("Created Nginx config")

# Enable site
run_ssh(ssh, 'ln -sf /etc/nginx/sites-available/roombook.co.za /etc/nginx/sites-enabled/roombook.co.za')
run_ssh(ssh, 'nginx -t')
run_ssh(ssh, 'systemctl reload nginx')

# Step 7: Get SSL cert
print("\nGetting SSL certificate...")
run_ssh(ssh, 'certbot --nginx -d roombook.co.za -d www.roombook.co.za --non-interactive --agree-tos --email johan@thewebjockeys.co.za 2>&1', timeout=120)

# Verify
run_ssh(ssh, 'pm2 list')
run_ssh(ssh, 'curl -sI http://localhost:3200 | head -5')

print("\n✅ Deployment complete! Visit https://roombook.co.za")
ssh.close()
