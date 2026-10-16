# Render real screenshots of the game with headless Edge.
# Run: powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\shots.ps1
# NOTE: keep this file ASCII-only - Windows PowerShell 5.1 reads BOM-less scripts as ANSI.
#
# The page is loaded inside tools/frame.html so the game gets an iframe of the exact
# requested CSS size: old headless Edge ignores --window-size and would otherwise
# render at its own viewport (483px wide) and stretch the bitmap.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path $edge)) { throw "Edge not found: $edge" }

$py = 'C:\Users\bavk2\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
if (-not (Test-Path $py)) { $py = 'python' }

$promo = Join-Path $root 'promo'
if (-not (Test-Path $promo)) { New-Item -ItemType Directory -Path $promo -Force | Out-Null }
$rawDir = Join-Path $root 'tools\.tmp'
if (-not (Test-Path $rawDir)) { New-Item -ItemType Directory -Path $rawDir -Force | Out-Null }

# Edge cannot grant its network sandbox access to a cache dir inside the workspace
# (the folder has strict permissions), so the profile lives in the system TEMP.
$profile = Join-Path $env:TEMP 'tapok-edge-profile'
if (-not (Test-Path $profile)) { New-Item -ItemType Directory -Path $profile -Force | Out-Null }

$frame = 'file:///' + ($root -replace '\\', '/') + '/tools/frame.html'
$dpr = 2

# The window is requested a bit larger than the frame: depending on flags Edge may
# report either the requested size or its own minimum window, and the frame must fit
# in both cases. crop.py then cuts the exact frame area out of the bitmap.
$shots = @(
    @{ name = '01-menu';     pose = 'menu';     w = 430; h = 860; win = '470,1040' },
    @{ name = '02-wave';     pose = 'wave';     w = 430; h = 860; win = '470,1040' },
    @{ name = '03-boss';     pose = 'boss';     w = 430; h = 860; win = '470,1040' },
    @{ name = '04-shop';     pose = 'shop';     w = 430; h = 860; win = '470,1040' },
    @{ name = '05-gameover'; pose = 'gameover'; w = 430; h = 860; win = '470,1040' },
    @{ name = '06-howto';    pose = 'howto';    w = 430; h = 860; win = '470,1040' },
    @{ name = '08-beetle';   pose = 'beetle';   w = 430; h = 860; win = '470,1040' },
    @{ name = '09-spider';   pose = 'spider';   w = 430; h = 860; win = '470,1040' },
    @{ name = '10-pause';    pose = 'pause';    w = 430; h = 860; win = '470,1040' },
    @{ name = '11-en-menu';  pose = 'menu';     w = 430; h = 860; win = '470,1040'; lang = 'en-US' },
    @{ name = '12-en-shop';  pose = 'shop';     w = 430; h = 860; win = '470,1040'; lang = 'en-US' },
    @{ name = '13-wide-shop'; pose = 'shop';    w = 1100; h = 600; win = '1140,800' },
    @{ name = '07-wide';     pose = 'wave';     w = 1100; h = 600; win = '1140,800' }
)

foreach ($s in $shots) {
    $inner = '../index.html?local=1&fresh=1&pose=' + $s.pose
    if ($s.lang) { $inner += '&lang=' + $s.lang.Substring(0, 2) }
    $src = [uri]::EscapeDataString($inner)
    $url = $frame + '?w=' + $s.w + '&h=' + $s.h + '&src=' + $src
    $raw = Join-Path $rawDir ($s.name + '-raw.png')
    $out = Join-Path $promo ($s.name + '.png')
    if (Test-Path $raw) { Remove-Item $raw -Force }
    if (Test-Path $out) { Remove-Item $out -Force }

    $edgeArgs = @(
        '--headless=old', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--disable-crash-reporter', '--disable-breakpad', '--hide-scrollbars',
        ('--force-device-scale-factor=' + $dpr),
        ('--user-data-dir=' + $profile),
        ('--window-size=' + $s.win)
    )
    if ($s.lang) { $edgeArgs += ('--lang=' + $s.lang) }
    $edgeArgs += @('--virtual-time-budget=7000', ('--screenshot=' + $raw), $url)
    $ErrorActionPreference = 'Continue'
    & $edge $edgeArgs 2>&1 | Out-Null
    $ErrorActionPreference = 'Stop'

    if (-not (Test-Path $raw)) { Write-Host ("FAIL {0}" -f $s.name); continue }
    & $py (Join-Path $PSScriptRoot 'crop.py') $raw $out $s.w $s.h $dpr
    Remove-Item $raw -Force
}

Write-Host ''
Write-Host '--- icon 512 ---'
# Иконка рисуется тем же кодом, что и игра: tools/icon.html
$iconRaw = Join-Path $rawDir 'icon-raw.png'
$iconBig = Join-Path $promo 'icon-1024.png'
$icon512 = Join-Path $promo 'icon-512.png'
foreach ($p in @($iconRaw, $iconBig, $icon512)) { if (Test-Path $p) { Remove-Item $p -Force } }
$iconUrl = $frame + '?w=512&h=512&src=' + [uri]::EscapeDataString('icon.html')
$iconArgs = @(
    '--headless=old', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-crash-reporter', '--disable-breakpad', '--hide-scrollbars',
    ('--force-device-scale-factor=' + $dpr),
    ('--user-data-dir=' + $profile),
    '--window-size=560,660',
    '--virtual-time-budget=4000',
    ('--screenshot=' + $iconRaw),
    $iconUrl
)
$ErrorActionPreference = 'Continue'
& $edge $iconArgs 2>&1 | Out-Null
$ErrorActionPreference = 'Stop'
if (Test-Path $iconRaw) {
    & $py (Join-Path $PSScriptRoot 'crop.py') $iconRaw $iconBig 512 512 $dpr
    & $py -c "from PIL import Image; im = Image.open(r'$iconBig'); im.resize((512, 512), Image.LANCZOS).save(r'$icon512'); print('ok   icon-512.png', im.size, '->', (512, 512))"
    Remove-Item $iconRaw -Force
} else {
    Write-Host 'FAIL icon'
}

Write-Host ''
Write-Host '--- console errors ---'
$log = Join-Path $profile 'chrome_debug.log'
if (Test-Path $log) {
    $bad = Select-String -Path $log -Pattern 'Uncaught|TypeError|ReferenceError|SyntaxError' -ErrorAction SilentlyContinue
    if ($bad) { $bad | Select-Object -Last 12 | ForEach-Object { Write-Host $_.Line } }
    else { Write-Host 'none' }
} else {
    Write-Host 'no log'
}
