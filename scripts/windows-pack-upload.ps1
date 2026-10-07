# Pack Zevooria for EC2 and upload the tarball.
# Usage:
#   .\scripts\windows-pack-upload.ps1
#   .\scripts\windows-pack-upload.ps1 -PemPath "D:\pem file of ssh\prod.pem" -HostIp "13.235.37.96"

param(
  [string]$PemPath = "D:\pem file of ssh\prod.pem",
  [string]$HostIp = "13.235.37.96",
  [string]$RemoteUser = "ubuntu"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$TarName = "zevooria-deploy.tar.gz"
$TarPath = Join-Path $RepoRoot $TarName

Write-Host "==> Creating $TarName (excludes .git, node_modules, .next, dist, .env, compose.local.yaml)"
if (Test-Path $TarPath) {
  Remove-Item -Force $TarPath
}

# Git Bash / Windows tar
& tar --exclude=.git --exclude=node_modules --exclude=.next --exclude=dist `
  --exclude=.env --exclude=compose.local.yaml --exclude=$TarName `
  -czf $TarName .
if ($LASTEXITCODE -ne 0) {
  throw "tar failed with exit code $LASTEXITCODE"
}

if (-not (Test-Path $PemPath)) {
  throw "PEM not found: $PemPath"
}

Write-Host "==> Uploading to ${RemoteUser}@${HostIp}:/home/ubuntu/"
& scp -i $PemPath $TarPath "${RemoteUser}@${HostIp}:/home/ubuntu/"
if ($LASTEXITCODE -ne 0) {
  throw "scp failed with exit code $LASTEXITCODE"
}

Write-Host ""
Write-Host "Upload done. Next:"
Write-Host "  1) Take an RDS snapshot (before the first operational DB wipe)."
Write-Host "  2) SSH:"
Write-Host ""
Write-Host "     ssh -i `"$PemPath`" ${RemoteUser}@${HostIp}"
Write-Host ""
Write-Host "  3) On the server, run ONLY:"
Write-Host ""
Write-Host "     cd /home/ubuntu"
Write-Host "     tar -xzf zevooria-deploy.tar.gz -O scripts/ec2-run-from-tarball.sh > /tmp/ec2-run-from-tarball.sh"
Write-Host "     bash /tmp/ec2-run-from-tarball.sh"
Write-Host ""
Write-Host "That runs swap, build, migrate, one-time DB reset (once only), smoke checks."
Write-Host "Do NOT run docker compose build --no-cache afterward."
