#!/usr/bin/env python3
"""
Set one or more env vars into the RoomBook Convex deployment, reading their
values from the local .env.local, via the VPS (the local Convex CLI is broken).

Usage:
    python3 scripts/set_convex_env.py PAYSTACK_SECRET_KEY PAYSTACK_PLAN_BASIC ...

Values are never printed. Convex functions read these via process.env; the
Convex deployment env is separate from .env.local (same as RESEND_API_KEY /
INTERNAL_API_SECRET). Reads VPS_HOST/VPS_USER/VPS_PASSWORD/VPS_APP_DIR.
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
    names = sys.argv[1:]
    if not names:
        print("Usage: set_convex_env.py VAR1 [VAR2 ...]", file=sys.stderr)
        return 2
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

    missing = [n for n in names if not env.get(n)]
    if missing:
        print(f"ERROR: not in .env.local: {', '.join(missing)}", file=sys.stderr)
        return 2

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password, timeout=30, look_for_keys=False, allow_agent=False)
    print(f"Connected to {user}@{host}")

    rc_all = 0
    for name in names:
        value = env[name]
        # Values here are Paystack keys/codes: [A-Za-z0-9_] only — safe to single-quote.
        if any(c in value for c in "'\"\\`$"):
            print(f"{name}: SKIPPED (unexpected shell-special chars)", file=sys.stderr)
            rc_all = 1
            continue
        _, out, _ = ssh.exec_command(
            f"cd {app_dir} && npx convex env set {name} '{value}' 2>&1 | tail -3",
            timeout=120,
        )
        text = out.read().decode("utf-8", errors="replace")
        rc = out.channel.recv_exit_status()
        status = "ok" if rc == 0 else f"FAILED (exit {rc})"
        # Redact the value if the CLI echoes it.
        print(f"{name}: {status}  {text.replace(value, '<redacted>').strip().splitlines()[-1] if text.strip() else ''}")
        if rc != 0:
            rc_all = rc

    ssh.close()
    return rc_all


if __name__ == "__main__":
    raise SystemExit(main())
