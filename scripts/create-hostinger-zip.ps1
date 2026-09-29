$sourceDir = "c:\Users\ARBAZ KHAN\Downloads\whatsapphospital-main\whatsapphospital-main"
$zipPath = "c:\Users\ARBAZ KHAN\Downloads\whatsapphospital-hostinger-deploy.zip"

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host "Creating Hostinger deployment zip file..."

$filesToZip = Get-ChildItem -Path $sourceDir -Exclude "node_modules", ".git", "temp_deploy_staging", "*.zip"

Compress-Archive -Path $filesToZip.FullName -DestinationPath $zipPath -Force

$zipItem = Get-Item $zipPath
$sizeMB = [math]::Round($zipItem.Length / 1MB, 2)
Write-Host "✅ ZIP created successfully!"
Write-Host "Location: $zipPath"
Write-Host "Size: $sizeMB MB"
