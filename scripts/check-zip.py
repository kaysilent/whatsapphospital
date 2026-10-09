import os
import zipfile

zip_path = 'whatsapphospital-deploy.zip'
tar_path = 'whatsapphospital-deploy.tar.gz'

print(f"ZIP size: {os.path.getsize(zip_path)/1024/1024:.2f} MB")
print(f"TAR.GZ size: {os.path.getsize(tar_path)/1024/1024:.2f} MB")

CRITICAL = ['package.json', 'package-lock.json', 'next.config.ts', 'server.js', 'app.js', 'tsconfig.json']

with zipfile.ZipFile(zip_path, 'r') as z:
    names = z.namelist()
    print(f"\nTotal ZIP entries: {len(names)}")
    print("Critical files check:")
    for c in CRITICAL:
        status = "OK" if c in names else "MISSING"
        print(f"  {c}: {status}")
    print("First 10:", names[:10])
