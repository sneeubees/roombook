#!/usr/bin/env python3
"""
Set INTERNAL_API_SECRET on the live deployment, in BOTH places that read it:
  1. the VPS Next.js env  (/var/www/roombook/.env.local)  — the /api/email/send route
  2. the Convex deployment env (`npx convex env set`)      — emailActions / getForPdf

The value is read from the LOCAL .env.local and is never printed to stdout.
Idempotent: the VPS .env.local line is only appended if missing; the Convex env
set is safe to repeat.

Reads VPS_HOST / VPS_USER / VPS_PASSWORD / VPS_APP_DIR from env or .env.local,
same as the other deploy scripts.
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
    secret = env.get("INTERNAL_API_SECRET")

    if not secret:
        print("ERROR: INTERNAL_API_SECRET missing from local .env.local", file=sys.stderr)
        return 2
    if not all([host, user, password]):
        print("ERROR: missing VPS credentials", file=sys.stderr)
        return 2
    # openssl rand -hex 32 → only [0-9a-f], safe to single-quote in a shell arg.
    if any(c not in "0123456789abcdefABCDEF" for c in secret):
        print("ERROR: secret has unexpected characters; aborting to avoid shell issues", file=sys.stderr)
        return 2

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password, timeout=30, look_for_keys=False, allow_agent=False)
    print(f"Connected to {user}@{host}")

    def run(cmd: str, timeout: int = 120) -> tuple[str, int]:
        _, out, _ = ssh.exec_command(cmd, timeout=timeout)
        text = out.read().decode("utf-8", errors="replace")
        return text, out.channel.recv_exit_status()

    # 1. VPS Next.js .env.local
    status, _ = run(f"grep -q '^INTERNAL_API_SECRET=' {app_dir}/.env.local && echo PRESENT || echo ABSENT", 30)
    if status.strip() == "PRESENT":
        print("VPS .env.local: INTERNAL_API_SECRET already present (left as-is)")
    else:
        res, _ = run(f"printf 'INTERNAL_API_SECRET=%s\\n' '{secret}' >> {app_dir}/.env.local && echo APPENDED", 30)
        print("VPS .env.local:", "appended" if res.strip() == "APPENDED" else "FAILED — check manually")

    # 2. Convex deployment env
    out, rc = run(f"cd {app_dir} && npx convex env set INTERNAL_API_SECRET '{secret}' 2>&1 | tail -5")
    print("Convex env set:")
    print("  " + out.replace(secret, "<redacted>").strip().replace("\n", "\n  "))

    ssh.close()
    return 0 if rc == 0 else rc


if __name__ == "__main__":
    raise SystemExit(main())
