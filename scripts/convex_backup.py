#!/usr/bin/env python3
"""
Snapshot the live Convex data to a local zip (a restore point).

The local Convex CLI has never worked reliably on this project, so — like
the deploy scripts — this SSHes into the VPS (which has a valid
`~/.convex/config.json`) and runs `npx convex export` there, then downloads
the resulting zip to ./backups/ on this machine.

Export is READ-ONLY: it snapshots tables + file storage and never mutates
the deployment, so it is safe to run against live at any time.

Restore (only if you ever need it), from the VPS in /var/www/roombook:
    npx convex import --replace-all backups/<file>.zip
Do NOT restore without deliberate intent — --replace-all wipes current data.

Reads the same env keys as scripts/deploy_vps.py (VPS_HOST, VPS_USER,
VPS_PASSWORD, VPS_APP_DIR).

Usage (from repo root):
    python3 scripts/convex_backup.py

Requires: python 3.9+ and `pip install paramiko`.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
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
        print("ERROR: missing required VPS credentials: " + ", ".join(missing), file=sys.stderr)
        return 2

    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    remote_path = f"/tmp/roombook-backup-{ts}.zip"
    local_dir = repo_root / "backups"
    local_dir.mkdir(exist_ok=True)
    local_path = local_dir / f"roombook-backup-{ts}.zip"

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

    # --include-file-storage captures uploaded logos / stored invoice PDFs too.
    cmd = (
        f"cd {app_dir} && npx convex export --path {remote_path} "
        f"--include-file-storage 2>&1 | tail -30"
    )
    print(f"\n>>> {cmd}")
    _, stdout, _ = ssh.exec_command(cmd, timeout=600)
    out = stdout.read().decode("utf-8", errors="replace")
    if out.strip():
        print(out.rstrip())
    rc = stdout.channel.recv_exit_status()
    if rc != 0:
        print(f"\nERROR: export failed (exit {rc}); nothing downloaded.", file=sys.stderr)
        ssh.close()
        return rc

    # Confirm the remote file exists and grab its size before downloading.
    _, stdout, _ = ssh.exec_command(f"stat -c %s {remote_path} 2>/dev/null", timeout=30)
    size_out = stdout.read().decode("utf-8", errors="replace").strip()
    if not size_out or not size_out.isdigit() or int(size_out) == 0:
        print(f"\nERROR: expected export at {remote_path} is missing or empty.", file=sys.stderr)
        ssh.close()
        return 1
    remote_size = int(size_out)

    print(f"\nDownloading {remote_path} ({remote_size:,} bytes) -> {local_path} ...")
    sftp = ssh.open_sftp()
    sftp.get(remote_path, str(local_path))
    sftp.close()

    # Clean up the remote temp copy so the VPS /tmp doesn't accumulate dumps.
    ssh.exec_command(f"rm -f {remote_path}")
    ssh.close()

    local_size = local_path.stat().st_size
    if local_size != remote_size:
        print(
            f"\nWARNING: size mismatch (remote {remote_size:,} != local {local_size:,}).",
            file=sys.stderr,
        )
        return 1

    print(f"\nBackup complete: {local_path} ({local_size:,} bytes)")
    print("Restore (deliberate only): npx convex import --replace-all <file> on the VPS.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
