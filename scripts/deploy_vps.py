#!/usr/bin/env python3
"""
Deploy RoomBook to the VPS.

Reads VPS credentials from environment variables, falling back to
`.env.local` in the repo root when they aren't set in the current shell.

Required keys (any of env / .env.local):
    VPS_HOST            e.g. 154.66.198.174
    VPS_USER            e.g. root
    VPS_PASSWORD        SSH password
Optional:
    VPS_APP_DIR         default /var/www/roombook
    VPS_PM2_PROCESS     default roombook

Usage (from repo root):
    python scripts/deploy_vps.py

Requires: python 3.9+ and `pip install paramiko`.

Never commit credentials — .env.local is gitignored. This script has
no secrets baked in.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def load_env_local(repo_root: Path) -> dict[str, str]:
    """Parse `.env.local` (KEY=VALUE lines) if it exists. Values already
    present in os.environ take precedence."""
    values: dict[str, str] = {}
    path = repo_root / ".env.local"
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        # Strip trailing `# comment` on the value (best-effort).
        if " #" in val:
            val = val.split(" #", 1)[0].strip()
        values[key] = val
    return values


def resolve(key: str, env_local: dict[str, str], default: str | None = None) -> str | None:
    return os.environ.get(key) or env_local.get(key) or default


def main() -> int:
    try:
        import paramiko  # type: ignore
    except ImportError:
        print("ERROR: paramiko not installed. Run: pip install paramiko", file=sys.stderr)
        return 2

    repo_root = Path(__file__).resolve().parent.parent
    env_local = load_env_local(repo_root)

    host = resolve("VPS_HOST", env_local)
    user = resolve("VPS_USER", env_local)
    password = resolve("VPS_PASSWORD", env_local)
    app_dir = resolve("VPS_APP_DIR", env_local, "/var/www/roombook")
    pm2_name = resolve("VPS_PM2_PROCESS", env_local, "roombook")

    missing = [k for k, v in {"VPS_HOST": host, "VPS_USER": user, "VPS_PASSWORD": password}.items() if not v]
    if missing:
        print(
            "ERROR: missing required VPS credentials: " + ", ".join(missing),
            file=sys.stderr,
        )
        print(
            "Set them in the environment or in .env.local at the repo root.",
            file=sys.stderr,
        )
        return 2

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]

    print(f"Connecting to {user}@{host} ...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        host,
        username=user,
        password=password,
        timeout=30,
        look_for_keys=False,
        allow_agent=False,
    )

    commands = [
        f"cd {app_dir} && git pull origin master 2>&1 | tail -8",
        f"cd {app_dir} && npm install 2>&1 | tail -5",
        f"cd {app_dir} && rm -rf .next && npm run build 2>&1 | tail -10",
        f"pm2 start {pm2_name} 2>&1 | tail -3 || pm2 restart {pm2_name} 2>&1 | tail -3",
        "pm2 list 2>&1 | tail -5",
    ]

    exit_code = 0
    for cmd in commands:
        print(f"\n>>> {cmd}")
        _, stdout, stderr = ssh.exec_command(cmd, timeout=600)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        if out.strip():
            print(out.rstrip())
        if err.strip():
            print("STDERR:", err.rstrip())
        rc = stdout.channel.recv_exit_status()
        if rc != 0:
            exit_code = rc

    ssh.close()
    print("\nDeploy finished.")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
