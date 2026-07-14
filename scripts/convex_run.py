#!/usr/bin/env python3
"""
Run a single Convex function on the VPS (the local Convex CLI is broken) and
print its output. Useful for one-off internal actions like provisionPlans.

Usage:
    python3 scripts/convex_run.py paystack:provisionPlans '{}'

Reads VPS_HOST/VPS_USER/VPS_PASSWORD/VPS_APP_DIR from env or .env.local.
"""
from __future__ import annotations

import shlex
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
    if len(sys.argv) < 2:
        print("Usage: convex_run.py <module:function> [jsonArgs]", file=sys.stderr)
        return 2
    fn = sys.argv[1]
    json_args = sys.argv[2] if len(sys.argv) > 2 else "{}"

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

    cmd = f"cd {app_dir} && npx convex run {shlex.quote(fn)} {shlex.quote(json_args)} 2>&1 | tail -30"
    print(f">>> {cmd}")
    _, stdout, _ = ssh.exec_command(cmd, timeout=180)
    out = stdout.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    print(out.rstrip())
    ssh.close()
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
