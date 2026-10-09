import os
import zipfile
import tarfile
import shutil

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

EXCLUDE_DIRS = {
    'node_modules',
    '.next',
    '.git',
    'scratch',
    'temp_deploy_staging',
    'staging_hostinger_deploy',
    '.agents',
    '.memory',
    '.gemini',
    '__pycache__',
    '.github',
    'docs',
    'mcp-server',
    'scripts'
}

EXCLUDE_FILES = {
    'whatsapphospital-deploy.zip',
    'whatsapphospital-deploy.tar.gz',
    'scratch_source_deploy.zip',
    'tsconfig.tsbuildinfo',
    'package-deploy.js',
    'sync-live-deploy.js',
    'live_verification_report.json',
    'test-api-loop.js',
    'test-api.js',
    'test_full_portal.py',
    'test_live_auth.py',
    'test_suite.ps1',
    'verify_live_deployment.py',
    'HOSTINGER_DEPLOYMENT_GUIDE.md',
    '.antigravityrules',
    'AGENTS.md',
    'CLAUDE.md',
    'CONTRIBUTING.md',
    'CHANGELOG.md',
    'README.md',
    'vercel.json',
    'docker-compose.yml',
    'Dockerfile',
    '.dockerignore',
    'next-env.d.ts',
}

EXCLUDE_EXT = {'.pyc', '.tar.gz', '.zip', '.tsbuildinfo'}


def create_packages():
    files_to_pack = []

    for root, dirs, files in os.walk(ROOT_DIR):
        dirs[:] = sorted([
            d for d in dirs
            if d not in EXCLUDE_DIRS and not d.startswith('.next')
        ])
        for file in files:
            if file in EXCLUDE_FILES:
                continue
            _, ext = os.path.splitext(file)
            if ext in EXCLUDE_EXT:
                continue

            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, ROOT_DIR).replace('\\', '/')
            files_to_pack.append((full_path, rel_path))

    zip_path = os.path.join(ROOT_DIR, 'whatsapphospital-deploy.zip')
    tar_path = os.path.join(ROOT_DIR, 'whatsapphospital-deploy.tar.gz')

    if os.path.exists(zip_path):
        os.remove(zip_path)
    if os.path.exists(tar_path):
        os.remove(tar_path)

    print(f"Packing {len(files_to_pack)} files...")
    print(f"Root: {ROOT_DIR}")

    # -----------------------------------------------
    # Create clean Unix-compatible ZIP
    # No directory entries, no dot-slash prefix,
    # create_system=3 (Unix), standard file attrs
    # -----------------------------------------------
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED, allowZip64=False) as zf:
        for full_path, arcname in files_to_pack:
            info = zipfile.ZipInfo(arcname)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3          # Unix
            info.external_attr = 0o100644 << 16  # -rw-r--r--
            with open(full_path, 'rb') as f:
                zf.writestr(info, f.read())

    zip_size = os.path.getsize(zip_path)
    print(f"ZIP created: {zip_path} ({zip_size/1024/1024:.2f} MB)")

    # -----------------------------------------------
    # Create clean POSIX TAR.GZ
    # No dot-slash prefix, no directory entries
    # -----------------------------------------------
    with tarfile.open(tar_path, 'w:gz', format=tarfile.GNU_FORMAT) as tf:
        for full_path, arcname in files_to_pack:
            tf.add(full_path, arcname=arcname)

    tar_size = os.path.getsize(tar_path)
    print(f"TAR.GZ created: {tar_path} ({tar_size/1024/1024:.2f} MB)")

    # -----------------------------------------------
    # Verify both archives
    # -----------------------------------------------
    print("\n--- Verifying ZIP ---")
    with zipfile.ZipFile(zip_path, 'r') as zf:
        result = zf.testzip()
        count = len(zf.namelist())
        names = zf.namelist()
        dot_slash = [n for n in names if n.startswith('./')]
        backslash = [n for n in names if '\\' in n]
        print(f"  Entries: {count}")
        print(f"  testzip: {'PASS (None)' if result is None else 'FAIL: ' + result}")
        print(f"  Dot-slash entries: {len(dot_slash)}")
        print(f"  Backslash entries: {len(backslash)}")
        print(f"  First 5: {names[:5]}")

    print("\n--- Verifying TAR.GZ ---")
    with tarfile.open(tar_path, 'r:gz') as tf:
        members = tf.getmembers()
        print(f"  Members: {len(members)}")
        print(f"  First 5: {[m.name for m in members[:5]]}")

    print("\nALL DONE.")


if __name__ == '__main__':
    create_packages()
