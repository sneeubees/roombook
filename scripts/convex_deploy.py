#!/usr/bin/env python3
"""
Push Convex functions from the VPS.

The local Convex CLI has never worked reliably on this project, so all
Convex deploys happen on the VPS (which has a valid `~/.convex/config.json`).
This script SSHes in and runs `npx convex dev --once`.

Reads the same env keys as scripts/deploy_vps.py (VPS_HOST, VPS_USER,
VPS_PASSWORD, VPS_APP_DIR).

Usage (from repo root):
    python scripts/convex_deploy.py

Requires: python 3.9+ and `pip install paramiko`.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def load_env_local(repo_root: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    path = repo_root / ".env.local"
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
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

    missing = [k for k, v in {"VPS_HOST": host, "VPS_USER": user, "VPS_PASSWORD": password}.items() if not v]
    if missing:
        print(
            "ERROR: missing required VPS credentials: " + ", ".join(missing),
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

    cmd = f"cd {app_dir} && npx convex dev --once 2>&1 | tail -25"
    print(f"\n>>> {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=600)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    if out.strip():
        print(out.rstrip())
    if err.strip():
        print("STDERR:", err.rstrip())
    rc = stdout.channel.recv_exit_status()
    ssh.close()
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
