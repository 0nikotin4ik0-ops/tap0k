# Build the Yandex Games archive: dist/tapok.zip with index.html at the archive root.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1
# NOTE: keep this file ASCII-only - Windows PowerShell 5.1 reads BOM-less scripts as ANSI.
$ErrorActionPreference = 'Stop'

$root = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist 'tapok'
$zip = Join-Path $dist 'tapok.zip'

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$include = @('index.html', 'css', 'js')
foreach ($item in $include) {
    $src = Join-Path $root $item
    if (-not (Test-Path $src)) { throw "Missing: $item" }
    Copy-Item $src -Destination $stage -Recurse -Force
}

# Requirement 1.22: no spaces and no non-ASCII characters in file names.
$bad = Get-ChildItem $stage -Recurse -File | Where-Object { $_.Name -match '[^\x20-\x7E]' -or $_.Name -match '\s' }
if ($bad) {
    $bad | ForEach-Object { Write-Host "BAD NAME: $($_.FullName)" }
    throw 'File names contain spaces or non-ASCII characters'
}

if (-not (Test-Path (Join-Path $stage 'index.html'))) { throw 'index.html is not at the archive root' }

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 2)
$unpacked = [math]::Round(((Get-ChildItem $stage -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB, 2)

Write-Host "Done: $zip"
Write-Host "Archive: $sizeMb MB, unpacked: $unpacked MB (limit 100 MB)"
