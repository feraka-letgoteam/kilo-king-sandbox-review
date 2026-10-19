"""Package the complete buildable v77 project from its committed source.

Runtime assets, current illustration sources, portable tests and configuration
are included. Historical proof/design archives remain in the private Git repo.
This is a source download, not a deployment operation.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument("destination", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
git = "/usr/bin/git" if Path("/usr/bin/git").exists() else shutil.which("git")
if not git:
    raise SystemExit("Run this packaging helper from the committed Git checkout.")
def command(*arguments):
    return subprocess.check_output([git, "-C", str(root), *arguments])
commit = command("rev-parse", "HEAD").decode().strip()
if command("status", "--porcelain").strip():
    raise SystemExit("Save the final source checkpoint before packaging.")
files = sorted(p for p in command("ls-files", "-z").decode().split("\0") if p)
files = [p for p in files if not p.startswith("art/") or p.startswith("art/kilo-v77/")]
files = [p for p in files if (root / p).is_file()]
assert "src/components/kilo/god-card-performance.ts" in files
assert "public/kilo-v77/vs/vice-5.webp" in files
assert "art/kilo-v77/baseline/v66/src/lib/kilo/reel-feature-math.ts" in files
manifest = {
    "version": "v77",
    "sourceCommit": commit,
    "scope": "Complete buildable project, all runtime assets, v77 illustration sources, portable checks and configuration.",
    "omitted": "Historical art proof/design archives under art/ before v77; retained in the private source repository. No runtime/build inputs omitted.",
    "files": [],
}
args.destination.parent.mkdir(parents=True, exist_ok=True)
temporary = args.destination.with_suffix(".partial.zip")
with zipfile.ZipFile(temporary, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
    for name in files:
        file = root / name
        with file.open("rb") as handle:
            digest = hashlib.file_digest(handle, "sha256").hexdigest()
        manifest["files"].append({"path": name, "bytes": file.stat().st_size, "sha256": digest})
        archive.write(file, "Kilo-King-v77/" + name)
    archive.writestr("Kilo-King-v77/SOURCE-CONTENTS.json", json.dumps(manifest, indent=2) + "\n")
with zipfile.ZipFile(temporary) as archive:
    assert archive.testzip() is None, "ZIP CRC validation failed"
    for item in manifest["files"]:
        with archive.open("Kilo-King-v77/" + item["path"]) as handle:
            assert hashlib.file_digest(handle, "sha256").hexdigest() == item["sha256"], item["path"]
os.replace(temporary, args.destination)
with args.destination.open("rb") as handle:
    sha = hashlib.file_digest(handle, "sha256").hexdigest()
print(json.dumps({"sourceCommit": commit, "archive": str(args.destination.resolve()), "files": len(files), "bytes": args.destination.stat().st_size, "sha256": sha, "crcAndContents": "PASS"}, indent=2))
