const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('--- Creating Clean Production Deploy Archive ---');

const staging = path.join(__dirname, '..', 'temp_deploy_staging');
if (fs.existsSync(staging)) {
  fs.rmSync(staging, { recursive: true, force: true });
}
fs.mkdirSync(staging, { recursive: true });

const items = [
  'server.js',
  'app.js',
  'package.json',
  'package-lock.json',
  'next.config.ts',
  'postcss.config.mjs',
  'tsconfig.json',
  '.htaccess',
  '.env.example',
  '.env.local.example',
  'public',
  'src',
  'supabase',
  'messages',
  'components.json'
];

for (const item of items) {
  const s = path.join(__dirname, '..', item);
  const d = path.join(staging, item);
  if (fs.existsSync(s)) {
    fs.cpSync(s, d, { recursive: true });
  }
}

const zipOut = path.join(__dirname, '..', 'whatsapphospital-deploy.zip');
if (fs.existsSync(zipOut)) {
  fs.rmSync(zipOut, { force: true });
}

execSync(`tar -a -c -f "${zipOut}" -C "${staging}" .`, { stdio: 'inherit' });

try {
  fs.rmSync(staging, { recursive: true, force: true });
} catch (e) {
  // Ignored on Windows
}

const sizeMb = (fs.statSync(zipOut).size / (1024 * 1024)).toFixed(2);
console.log(`Successfully created ${zipOut} (${sizeMb} MB)`);
