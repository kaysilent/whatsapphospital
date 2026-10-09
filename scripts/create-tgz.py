import os
import tarfile

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

EXCLUDE_DIRS = {
    'node_modules', '.next', '.git', 'scratch', 'temp_deploy_staging',
    'staging_hostinger_deploy', '.agents', '.memory', '.gemini',
    '__pycache__', 'temp_hostinger_stage', '.github', 'docs',
    'mcp-server', 'scripts'
}

EXCLUDE_FILES = {
    'whatsapphospital-deploy.zip',
    'whatsapphospital-deploy.tar.gz',
    'whatsapphospital-deploy.tgz',
    'scratch_source_deploy.zip',
    'tsconfig.tsbuildinfo',
    'package-deploy.js',
    'sync-live-deploy.js',
}

EXCLUDE_EXT = {'.pyc', '.tsbuildinfo'}

files_to_pack = []
for root, dirs, files in os.walk(ROOT_DIR):
    dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
    for f in files:
        if f in EXCLUDE_FILES:
            continue
        _, ext = os.path.splitext(f)
        if ext in EXCLUDE_EXT or f.endswith('.tar.gz') or f.endswith('.tgz') or f.endswith('.zip'):
            continue
        full = os.path.join(root, f)
        rel = os.path.relpath(full, ROOT_DIR).replace('\\', '/')
        files_to_pack.append((full, rel))

print(f'Packing {len(files_to_pack)} files...')

tgz_path = os.path.join(ROOT_DIR, 'whatsapphospital-deploy.tgz')
if os.path.exists(tgz_path):
    os.remove(tgz_path)

with tarfile.open(tgz_path, 'w:gz', format=tarfile.GNU_FORMAT) as t:
    for full, rel in files_to_pack:
        t.add(full, arcname=rel)

size_mb = os.path.getsize(tgz_path) / 1024 / 1024
print(f'TGZ size: {size_mb:.2f} MB')

with tarfile.open(tgz_path, 'r:gz') as t:
    members = t.getmembers()
    print(f'Members: {len(members)}')
    print('First 5:', [m.name for m in members[:5]])

print('Done.')
