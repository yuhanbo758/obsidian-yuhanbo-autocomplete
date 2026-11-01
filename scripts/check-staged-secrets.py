"""Scan the exact Git index snapshot before committing."""
import subprocess
import sys
import tempfile
from pathlib import Path

names = subprocess.check_output(["git", "ls-files", "-z"]).decode("utf-8").split("\0")
with tempfile.TemporaryDirectory(prefix="plugin-staged-scan-") as directory:
    root = Path(directory)
    for name in filter(None, names):
        destination = root.joinpath(*Path(name).parts)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(subprocess.check_output(["git", "show", ":" + name]))
    result = subprocess.run([sys.executable, "scripts/security-scan.py", str(root), "--severity", "high", "--no-color"])
    sys.exit(result.returncode)
