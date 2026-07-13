# Deploy scripts

Two Python scripts that manage RoomBook's split deployment:

- **`deploy_vps.py`** — pushes the Next.js app to the VPS: `git pull`,
  `npm install`, `npm run build`, `pm2 restart`.
- **`convex_deploy.py`** — pushes Convex functions via `npx convex dev
  --once` on the VPS (the local Convex CLI hasn't worked reliably on
  this project).

## Setup

```bash
pip install paramiko
```

Both scripts read credentials from environment variables, falling back
to `.env.local` in the repo root when they aren't set in the shell.
`.env.local` is gitignored — never commit it.

Required keys (any of env / `.env.local`):

| Key | Purpose |
|---|---|
| `VPS_HOST` | e.g. `154.66.198.174` |
| `VPS_USER` | e.g. `root` |
| `VPS_PASSWORD` | SSH password |

Optional overrides:

| Key | Default |
|---|---|
| `VPS_APP_DIR` | `/var/www/roombook` |
| `VPS_PM2_PROCESS` | `roombook` |

## Usage

```bash
# From the repo root, after `git push`
python scripts/deploy_vps.py

# If convex/*.ts changed too
python scripts/convex_deploy.py
```

## Typical release flow

```bash
git add -A
git commit -m "..."
git push
python scripts/deploy_vps.py           # always
python scripts/convex_deploy.py        # only when Convex changed
```

## Handover notes

If you're on a new machine (e.g. a fresh Mac), the only thing you need
beyond the repo is `.env.local`. Copy it over (any private channel),
then both scripts will work. No secrets live in this directory or in
git — everything is loaded at run time.
