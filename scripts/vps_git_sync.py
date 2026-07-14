#!/usr/bin/env python3
"""
Sync the VPS working tree to origin/master (fetch + hard reset), so the Convex
deploy that follows picks up the freshly-pushed code. `convex_deploy.py` runs
`convex dev --once` but does NOT pull, so this must run first for a Convex-first
deploy order.

`git reset --hard origin/master` only touches tracked files; .env.local,
node_modules and .next are gitignored and untouched. Prints the pre-reset
working-tree status for transparency.
"""
from __future__ import annotations

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
        values[key.strip()] = val.strip().strip('"').strip("'")
    return values


def main() -> int:
    try:
        import paramiko  # type: ignore
    except ImportError:
        print("ERROR: paramiko not installed.", file=sys.stderr)
        return 2

    repo_root = Path(__file__).resolve().parent.parent
    env = load_env_local(repo_root)
    host, user, password = env.get("VPS_HOST"), env.get("VPS_USER"), env.get("VPS_PASSWORD")
    app_dir = env.get("VPS_APP_DIR", "/var/www/roombook")
    if not all([host, user, password]):
        print("ERROR: missing VPS credentials", file=sys.stderr)
        return 2

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password, timeout=30, look_for_keys=False, allow_agent=False)
    print(f"Connected to {user}@{host}")

    cmd = (
        f"cd {app_dir} && git fetch origin 2>&1 | tail -2 && "
        f"echo '--- pre-reset working tree (tracked changes to be discarded) ---' && "
        f"git status --short && "
        f"echo '--- resetting to origin/master ---' && "
        f"git reset --hard origin/master 2>&1 | tail -3 && "
        f"echo '--- now at ---' && git log --oneline -1"
    )
    print(f"\n>>> {cmd}")
    _, stdout, _ = ssh.exec_command(cmd, timeout=120)
    out = stdout.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    print(out.rstrip())
    ssh.close()
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
