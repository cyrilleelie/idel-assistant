# ============================================================
# start-all.ps1 — Lance tous les services IDEL Assistant
#
# Usage :
#   .\start-all.ps1              # Tout lancer
#   .\start-all.ps1 -Gpu         # + stack GPU
#   .\start-all.ps1 -NoMobile    # Sans Expo mobile
#   .\start-all.ps1 -Stop        # Tout arreter proprement
# ============================================================

param(
    [switch]$Gpu,
    [switch]$NoMobile,
    [switch]$Stop
)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidsFile = Join-Path $ProjectRoot ".running-pids.json"

# --- Colors ---
function Log($msg)  { Write-Host "[IDEL] $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[IDEL] $msg" -ForegroundColor Yellow }
function Err($msg)  { Write-Host "[IDEL] $msg" -ForegroundColor Red }

# --- Kill a process tree recursively ---
function Stop-ProcessTree($procId) {
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ParentProcessId -eq $procId } |
        ForEach-Object { Stop-ProcessTree $_.ProcessId }
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}

# --- Stop mode ---
function Stop-All {
    Log "Arret des services..."

    if (Test-Path $PidsFile) {
        $savedPids = Get-Content $PidsFile | ConvertFrom-Json
        foreach ($svc in $savedPids.PSObject.Properties) {
            $procId = $svc.Value
            $procName = $svc.Name
            if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
                Log "  Arret $procName (PID $procId)"
                Stop-ProcessTree $procId
            }
        }
        Remove-Item $PidsFile -Force
    }

    # Stop any PowerShell background jobs from this session
    Get-Job | Where-Object { $_.State -eq 'Running' } | Stop-Job -PassThru | Remove-Job

    Log "  Arret conteneurs Docker..."
    Set-Location $ProjectRoot
    docker compose down 2>$null
    if ($Gpu) {
        docker compose -f gpu/docker-compose.gpu.yml down 2>$null
    }

    Log "Tous les services sont arretes."
}

if ($Stop) {
    Stop-All
    exit 0
}

# --- Auto-cleanup: stop previous run if PIDs file exists ---
if (Test-Path $PidsFile) {
    Warn "Session precedente detectee - nettoyage automatique..."
    Stop-All
}

# --- Kill any orphan process still holding port 8000, then wait for it to be free ---
$portCheck = netstat -ano 2>$null | Select-String ":8000\s+.*LISTENING"
foreach ($line in $portCheck) {
    if ($line -match '\s(\d+)\s*$') {
        $orphanPid = [int]$Matches[1]
        $proc = Get-Process -Id $orphanPid -ErrorAction SilentlyContinue
        if ($proc -and $proc.Name -match "python|uvicorn") {
            Warn "  Port 8000 occupe par $($proc.Name) (PID $orphanPid) - arret..."
            Stop-ProcessTree $orphanPid
        }
    }
}
# Wait until port 8000 is truly free (ghost sockets can linger on Windows)
$portFree = $false
for ($w = 1; $w -le 30; $w++) {
    $stillListening = netstat -ano 2>$null | Select-String ":8000\s+.*LISTENING"
    if (-not $stillListening) {
        $portFree = $true
        break
    }
    if ($w -eq 1) { Warn "  Attente liberation du port 8000..." }
    Start-Sleep -Seconds 2
}
if (-not $portFree) {
    Err "  Port 8000 toujours occupe apres 60s. Redemarrez votre PC ou liberez le port manuellement."
    exit 1
}

# --- Track PIDs ---
$script:RunningPids = @{}

function Save-Pids {
    $script:RunningPids | ConvertTo-Json | Set-Content $PidsFile
}

# --- Resolve .cmd wrappers to node.exe path ---
# npm/npx are .cmd files on Windows; Start-Process -NoNewWindow can't run them.
# We resolve to node.exe and call the JS entry point directly.
function Get-NodeExe {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCmd) {
        return Join-Path (Split-Path $npmCmd.Source) "node.exe"
    }
    return "node"
}

function Get-NpmCliJs {
    $npmCmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($npmCmd) {
        $npmDir = Split-Path $npmCmd.Source
        $cliJs = Join-Path $npmDir "node_modules\npm\bin\npm-cli.js"
        if (Test-Path $cliJs) { return $cliJs }
    }
    return $null
}

function Get-NpxCliJs {
    $npxCmd = Get-Command npx -ErrorAction SilentlyContinue
    if ($npxCmd) {
        $npxDir = Split-Path $npxCmd.Source
        $cliJs = Join-Path $npxDir "node_modules\npm\bin\npx-cli.js"
        if (Test-Path $cliJs) { return $cliJs }
    }
    return $null
}

$NodeExe = Get-NodeExe
$NpmCli = Get-NpmCliJs
$NpxCli = Get-NpxCliJs

# ============================================================
# 1. Docker : PostgreSQL + Redis + Adminer
# ============================================================
Log "1/5 - Demarrage Docker (PostgreSQL, Redis, Adminer)..."
Set-Location $ProjectRoot
docker compose up -d

Log "     Attente PostgreSQL..."
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    $health = docker inspect --format='{{.State.Health.Status}}' idel-postgres 2>$null
    if ($health -match "healthy") {
        Log "     PostgreSQL pret (healthy)."
        $ready = $true
        break
    }
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", 5432)
        $tcp.Close()
        Log "     PostgreSQL pret (port 5432 ouvert)."
        $ready = $true
        break
    } catch {}
    Start-Sleep -Seconds 1
}
if (-not $ready) {
    Err "     PostgreSQL non disponible apres 30s !"
    exit 1
}

# ============================================================
# 1b. (Optionnel) Docker GPU
# ============================================================
if ($Gpu) {
    Log "1b   - Demarrage stack GPU (vLLM, Whisper, Kokoro)..."
    docker compose -f gpu/docker-compose.gpu.yml up -d
}

# ============================================================
# 2. Backend FastAPI
# ============================================================
Log "2/5 - Demarrage Backend (FastAPI sur :8000)..."
Set-Location (Join-Path $ProjectRoot "backend")

Log "     Application des migrations Alembic..."
uv run alembic upgrade head 2>&1 | Select-Object -Last 1

$backendProc = Start-Process -FilePath "uv" `
    -ArgumentList "run", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000" `
    -WorkingDirectory (Join-Path $ProjectRoot "backend") `
    -PassThru -NoNewWindow
$script:RunningPids["backend"] = $backendProc.Id
Log "     Backend demarre (PID $($backendProc.Id))."

Log "     Attente API..."
for ($i = 1; $i -le 15; $i++) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", 8000)
        $tcp.Close()
        Log "     API prete : http://localhost:8000/docs"
        break
    } catch {}
    if ($i -eq 15) { Warn "     API pas encore prete - elle devrait arriver sous peu." }
    Start-Sleep -Seconds 1
}

# ============================================================
# 3. Frontend Web (Vite)
# ============================================================
Log "3/5 - Demarrage Frontend Web (Vite sur :5173)..."
if ($NpmCli) {
    # Launch node.exe directly with npm-cli.js — no cmd.exe needed
    $frontendWebProc = Start-Process -FilePath $NodeExe `
        -ArgumentList "`"$NpmCli`"", "run", "dev" `
        -WorkingDirectory (Join-Path $ProjectRoot "frontend-web") `
        -PassThru -NoNewWindow
} else {
    # Fallback: launch in a separate window
    $frontendWebProc = Start-Process -FilePath "npm" `
        -ArgumentList "run", "dev" `
        -WorkingDirectory (Join-Path $ProjectRoot "frontend-web") `
        -PassThru
}
$script:RunningPids["frontend-web"] = $frontendWebProc.Id
Log "     Frontend Web demarre : http://localhost:5173"

# ============================================================
# 4. Frontend Mobile (Expo)
# ============================================================
if (-not $NoMobile) {
    Log "4/5 - Demarrage Frontend Mobile (Expo)..."
    if ($NpxCli) {
        $mobileProc = Start-Process -FilePath $NodeExe `
            -ArgumentList "`"$NpxCli`"", "expo", "start", "--lan" `
            -WorkingDirectory (Join-Path $ProjectRoot "frontend-mobile") `
            -PassThru -NoNewWindow
    } else {
        $mobileProc = Start-Process -FilePath "npx" `
            -ArgumentList "expo", "start", "--lan" `
            -WorkingDirectory (Join-Path $ProjectRoot "frontend-mobile") `
            -PassThru
    }
    $script:RunningPids["frontend-mobile"] = $mobileProc.Id
    Log "     Expo demarre - scanner le QR code dans le terminal."
} else {
    Warn "4/5 - Frontend Mobile : ignore (-NoMobile)"
}

# ============================================================
# 5. Corpus Review Server
# ============================================================
Log "5/5 - Demarrage Corpus Review Server (:8502)..."
$reviewProc = Start-Process -FilePath "python" `
    -ArgumentList (Join-Path $ProjectRoot "scripts\corpus_generation\review_server.py") `
    -WorkingDirectory (Join-Path $ProjectRoot "backend") `
    -PassThru -NoNewWindow
$script:RunningPids["corpus-review"] = $reviewProc.Id
Log "     Review Corpus : http://localhost:8502"

# --- Save PIDs for -Stop ---
Save-Pids

# ============================================================
# Resume
# ============================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  IDEL Assistant - Tous services actifs " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Docker         : PostgreSQL :5432 | Redis :6379 | Adminer :8080" -ForegroundColor Cyan
if ($Gpu) {
Write-Host "  GPU Stack      : vLLM + Whisper + Kokoro via :9000" -ForegroundColor Cyan
}
Write-Host "  Backend API    : http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "  Frontend Web   : http://localhost:5173" -ForegroundColor Cyan
if (-not $NoMobile) {
Write-Host "  Frontend Mobile: Expo (voir QR code ci-dessus)" -ForegroundColor Cyan
}
Write-Host "  Corpus Review  : http://localhost:8502" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Pour arreter : .\start-all.ps1 -Stop" -ForegroundColor Yellow
Write-Host "  Ou tapez 'q' puis Entree" -ForegroundColor Yellow
Write-Host ""

# --- Wait loop : read input line to quit ---
while ($true) {
    # Non-blocking check: is there a line ready?
    if ([Console]::KeyAvailable) {
        $line = Read-Host
        if ($line -eq 'q' -or $line -eq 'Q' -or $line -eq 'quit' -or $line -eq 'exit') {
            break
        }
    }
    # Check if all processes died
    $alive = $false
    foreach ($procId in $script:RunningPids.Values) {
        if (Get-Process -Id $procId -ErrorAction SilentlyContinue) {
            $alive = $true
            break
        }
    }
    if (-not $alive) {
        Warn "Tous les processus se sont arretes."
        break
    }
    Start-Sleep -Milliseconds 500
}

Stop-All
