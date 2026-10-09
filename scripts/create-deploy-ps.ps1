Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$staging = 'temp_hostinger_stage'
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Path $staging | Out-Null

$items = @(
    'package.json','package-lock.json','next.config.ts','server.js','app.js',
    'tsconfig.json','postcss.config.mjs','.htaccess','public','src',
    'supabase','messages','hospital-profile.json',
    '.env','.env.production','.env.local','.env.example','.env.local.example',
    '.prettierrc','.editorconfig','vitest.config.ts','components.json'
)

foreach ($item in $items) {
    if (Test-Path $item) {
        Copy-Item -Path $item -Destination $staging -Recurse -Force
        Write-Host "Copied: $item"
    }
}

Write-Host "`nStaging contents:"
Get-ChildItem $staging | Select-Object Name

$zipPath = (Resolve-Path '.').Path + '\whatsapphospital-deploy.zip'
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

Compress-Archive -Path "$staging\*" -DestinationPath $zipPath -CompressionLevel Optimal -Force

Write-Host "`nZIP created: $zipPath"
$sz = [math]::Round((Get-Item $zipPath).Length/1MB, 2)
Write-Host "ZIP size: $sz MB"

Remove-Item -Recurse -Force $staging
Write-Host "Done."
